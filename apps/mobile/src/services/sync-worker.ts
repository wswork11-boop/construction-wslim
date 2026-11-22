import { MobileApiClient } from '../api/client';
import { LocalSqliteRepository } from '../db/sqlite-repository';

export interface SyncRunResult {
  syncedIds: string[];
  failedIds: string[];
  requeuedIds: string[];
  nextBackoffMs: number;
}

export class SyncWorker {
  private isRunning = false;
  private consecutiveNetworkFailures = 0;

  constructor(
    private readonly repo: LocalSqliteRepository,
    private readonly api: MobileApiClient,
    private readonly loadPhotoBytes: (localUri: string) => Promise<{
      bytes: Uint8Array;
      fileName: string;
      mimeType: string;
    }> = async (uri) => ({
      bytes: new TextEncoder().encode(`photo-bytes:${uri}`),
      fileName: 'site-photo.jpg',
      mimeType: 'image/jpeg',
    }),
  ) {}

  getBackoffMs(): number {
    if (this.consecutiveNetworkFailures === 0) return 0;
    return Math.min(60_000, 1000 * Math.pow(2, this.consecutiveNetworkFailures - 1));
  }

  retryFailedReport(reportId: string) {
    this.repo.updateReportSyncState(reportId, 'QUEUED', null);
  }

  // T10: Only one sync run at a time. Processes QUEUED reports oldest first.
  async runSync(): Promise<SyncRunResult | null> {
    if (this.isRunning) {
      return null;
    }
    this.isRunning = true;

    const syncedIds: string[] = [];
    const failedIds: string[] = [];
    const requeuedIds: string[] = [];

    try {
      const queued = this.repo.getQueuedReportsOldestFirst();
      for (const report of queued) {
        this.repo.updateReportSyncState(report.id, 'SYNCING', null);

        try {
          // Step 1: For each photo without fileId: presign, upload, store fileId.
          // Resumes from the first photo not yet uploaded!
          const photos = this.repo.getPhotosForReport(report.id);
          for (const photo of photos) {
            if (!photo.fileId) {
              const fileData = await this.loadPhotoBytes(photo.localUri);
              const presignRes = await this.api.request<{
                fileId: string;
                uploadUrl: string;
                expiresAt: string;
              }>('/files/presign', {
                method: 'POST',
                body: {
                  fileName: fileData.fileName,
                  mimeType: fileData.mimeType,
                  size: fileData.bytes.byteLength,
                  purpose: 'DAILY_REPORT_PHOTO',
                },
              });

              if (presignRes.status >= 400 && presignRes.status < 500) {
                const msg =
                  (presignRes.data as any)?.message ||
                  `Photo presign rejected (${presignRes.status})`;
                this.repo.updateReportSyncState(report.id, 'FAILED', msg);
                failedIds.push(report.id);
                break;
              }
              if (presignRes.status >= 500) {
                throw new Error(`Server error ${presignRes.status} on presign`);
              }

              await this.api.uploadToPresignedUrl(
                presignRes.data.uploadUrl,
                fileData.bytes,
                fileData.mimeType,
              );
              this.repo.markPhotoUploaded(photo.id, presignRes.data.fileId);
            }
          }

          // Check if photo loop marked the report FAILED
          if (this.repo.getReport(report.id)?.syncState === 'FAILED') {
            continue;
          }

          // Step 2: PUT /daily-reports/:id with the full payload
          const updatedPhotos = this.repo.getPhotosForReport(report.id);
          const putBody = {
            projectId: report.payload.projectId,
            reportDate: report.payload.reportDate,
            weather: report.payload.weather,
            workDone: report.payload.workDone,
            issues: report.payload.issues ?? null,
            nextDayPlan: report.payload.nextDayPlan ?? null,
            latitude: report.payload.latitude ?? null,
            longitude: report.payload.longitude ?? null,
            deviceCreatedAt: report.payload.deviceCreatedAt,
            manpower: report.payload.manpower,
            photos: updatedPhotos.map((p) => ({
              fileId: p.fileId!,
              caption: p.caption ?? null,
              takenAt: p.takenAt ?? null,
            })),
          };

          const putRes = await this.api.request(`/daily-reports/${report.id}`, {
            method: 'PUT',
            body: putBody,
          });

          if (putRes.status >= 200 && putRes.status < 300) {
            // On 2xx mark SYNCED
            this.repo.updateReportSyncState(report.id, 'SYNCED', null);
            this.consecutiveNetworkFailures = 0;
            syncedIds.push(report.id);
          } else if (putRes.status >= 400 && putRes.status < 500) {
            // On 4xx mark FAILED with the server message (no auto retry)
            const msg = (putRes.data as any)?.message || `Request rejected (${putRes.status})`;
            this.repo.updateReportSyncState(report.id, 'FAILED', msg);
            failedIds.push(report.id);
          } else {
            throw new Error(`Server returned ${putRes.status}`);
          }
        } catch (err: any) {
          // On network error or 5xx keep QUEUED with backoff
          this.consecutiveNetworkFailures++;
          this.repo.updateReportSyncState(
            report.id,
            'QUEUED',
            err?.message || 'Network unavailable',
          );
          requeuedIds.push(report.id);
        }
      }
    } finally {
      this.isRunning = false;
    }

    return {
      syncedIds,
      failedIds,
      requeuedIds,
      nextBackoffMs: this.getBackoffMs(),
    };
  }
}
