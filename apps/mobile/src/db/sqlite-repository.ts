import { v7 as uuidv7 } from 'uuid';
import { Weather } from '@construction/shared';

export type SyncState = 'DRAFT' | 'QUEUED' | 'SYNCING' | 'SYNCED' | 'FAILED';
export type PhotoUploadState = 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'FAILED';

// AC2: Each report shows a clear state on the phone: Draft, Waiting to upload, Uploading, Uploaded, Failed (with retry).
export function getSyncStateLabel(state: SyncState): string {
  switch (state) {
    case 'DRAFT':
      return 'Draft';
    case 'QUEUED':
      return 'Waiting to upload';
    case 'SYNCING':
      return 'Uploading';
    case 'SYNCED':
      return 'Uploaded';
    case 'FAILED':
      return 'Failed';
  }
}

export interface LocalManpowerRow {
  trade: string;
  headcount: number;
}

export interface LocalReportPayload {
  projectId: string;
  reportDate: string;
  weather: Weather | null;
  workDone: string;
  issues?: string | null;
  nextDayPlan?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  deviceCreatedAt: string;
  manpower: LocalManpowerRow[];
}

export interface LocalReportRecord {
  id: string;
  projectId: string;
  reportDate: string;
  payload: LocalReportPayload;
  syncState: SyncState;
  lastError: string | null;
  updatedAt: string;
}

export interface LocalPhotoRecord {
  id: string;
  reportId: string;
  localUri: string;
  fileId: string | null;
  caption: string | null;
  takenAt: string | null;
  uploadState: PhotoUploadState;
}

export interface CachedProjectRecord {
  id: string;
  payload: {
    id: string;
    code: string;
    name: string;
    siteAddress: string | null;
    status: string;
  };
  fetchedAt: string;
}

export const SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS local_report (
  id TEXT PRIMARY KEY NOT NULL,
  projectId TEXT NOT NULL,
  reportDate TEXT NOT NULL,
  payload TEXT NOT NULL,
  syncState TEXT NOT NULL,
  lastError TEXT,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS local_photo (
  id TEXT PRIMARY KEY NOT NULL,
  reportId TEXT NOT NULL,
  localUri TEXT NOT NULL,
  fileId TEXT,
  caption TEXT,
  takenAt TEXT,
  uploadState TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cached_project (
  id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  fetchedAt TEXT NOT NULL
);
`;

export class LocalSqliteRepository {
  private reports = new Map<string, LocalReportRecord>();
  private photos = new Map<string, LocalPhotoRecord>();
  private cachedProjects = new Map<string, CachedProjectRecord>();
  private cachedServerReports = new Map<string, any>();

  // AC4: One report per user, per project, per date. A second attempt opens the existing report for editing.
  findReportByProjectAndDate(projectId: string, reportDate: string): LocalReportRecord | null {
    for (const r of this.reports.values()) {
      if (r.projectId === projectId && r.reportDate === reportDate) {
        return r;
      }
    }
    return null;
  }

  getReport(id: string): LocalReportRecord | null {
    return this.reports.get(id) ?? null;
  }

  listReportsByProject(projectId: string): LocalReportRecord[] {
    return Array.from(this.reports.values())
      .filter((r) => r.projectId === projectId)
      .sort((a, b) => (a.reportDate < b.reportDate ? 1 : -1));
  }

  // T08: Draft autosave (also remembers yesterday's manpower trades when creating a new draft)
  saveDraft(
    payload: LocalReportPayload,
    photosInput: Array<{
      id?: string;
      localUri: string;
      fileId?: string | null;
      caption?: string | null;
      takenAt?: string | null;
    }>,
    existingId?: string,
  ): { report: LocalReportRecord; photos: LocalPhotoRecord[] } {
    const existingForSlot =
      (existingId ? this.reports.get(existingId) : null) ||
      this.findReportByProjectAndDate(payload.projectId, payload.reportDate);

    const id = existingForSlot?.id || existingId || uuidv7();
    const now = new Date().toISOString();

    let manpower = payload.manpower;
    if ((!manpower || manpower.length === 0) && !existingForSlot) {
      manpower = this.getRecentTradesForProject(payload.projectId).map((trade) => ({
        trade,
        headcount: 0,
      }));
    }

    const record: LocalReportRecord = {
      id,
      projectId: payload.projectId,
      reportDate: payload.reportDate,
      payload: { ...payload, manpower },
      syncState: existingForSlot?.syncState === 'SYNCED' ? 'DRAFT' : existingForSlot?.syncState || 'DRAFT',
      lastError: null,
      updatedAt: now,
    };
    this.reports.set(id, record);

    // Replace photos for this report while preserving existing fileIds if already uploaded
    const prevPhotosByUri = new Map<string, LocalPhotoRecord>();
    for (const p of this.getPhotosForReport(id)) {
      prevPhotosByUri.set(p.localUri, p);
      this.photos.delete(p.id);
    }

    const savedPhotos: LocalPhotoRecord[] = photosInput.map((p) => {
      const prev = prevPhotosByUri.get(p.localUri);
      const photoId = p.id || prev?.id || uuidv7();
      const fileId = p.fileId ?? prev?.fileId ?? null;
      const rec: LocalPhotoRecord = {
        id: photoId,
        reportId: id,
        localUri: p.localUri,
        fileId,
        caption: p.caption ?? null,
        takenAt: p.takenAt ?? prev?.takenAt ?? now,
        uploadState: fileId ? 'UPLOADED' : 'PENDING',
      };
      this.photos.set(photoId, rec);
      return rec;
    });

    return { report: record, photos: savedPhotos };
  }

  getRecentTradesForProject(projectId: string): string[] {
    const previous = this.listReportsByProject(projectId);
    if (previous.length === 0) {
      return ['Carpenter', 'Bricklayer', 'General worker'];
    }
    return previous[0].payload.manpower.map((m) => m.trade);
  }

  getPhotosForReport(reportId: string): LocalPhotoRecord[] {
    return Array.from(this.photos.values()).filter((p) => p.reportId === reportId);
  }

  queueForSync(reportId: string): LocalReportRecord {
    const r = this.reports.get(reportId);
    if (!r) {
      throw new Error(`Report ${reportId} not found`);
    }
    const photos = this.getPhotosForReport(reportId);
    if (!r.payload.workDone.trim()) {
      throw new Error('Work done is required');
    }
    if (photos.length === 0) {
      throw new Error('At least one photo is required');
    }
    r.syncState = 'QUEUED';
    r.lastError = null;
    r.updatedAt = new Date().toISOString();
    return r;
  }

  getQueuedReportsOldestFirst(): LocalReportRecord[] {
    return Array.from(this.reports.values())
      .filter((r) => r.syncState === 'QUEUED')
      .sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : 1));
  }

  getPendingOrFailedReports(): LocalReportRecord[] {
    return Array.from(this.reports.values()).filter(
      (r) => r.syncState === 'QUEUED' || r.syncState === 'SYNCING' || r.syncState === 'FAILED',
    );
  }

  updateReportSyncState(reportId: string, state: SyncState, lastError: string | null = null) {
    const r = this.reports.get(reportId);
    if (!r) return;
    r.syncState = state;
    r.lastError = lastError;
    r.updatedAt = new Date().toISOString();
  }

  markPhotoUploaded(photoId: string, fileId: string) {
    const p = this.photos.get(photoId);
    if (!p) return;
    p.fileId = fileId;
    p.uploadState = 'UPLOADED';
  }

  // T13: Offline cache of projects and recent 30 days of reports
  cacheProjects(projects: Array<CachedProjectRecord['payload']>) {
    const now = new Date().toISOString();
    this.cachedProjects.clear();
    for (const p of projects) {
      // Strip any accidental price fields before caching locally on device
      const safe = {
        id: p.id,
        code: p.code,
        name: p.name,
        siteAddress: p.siteAddress ?? null,
        status: p.status,
      };
      this.cachedProjects.set(p.id, { id: p.id, payload: safe, fetchedAt: now });
    }
  }

  getCachedProjects(): Array<CachedProjectRecord['payload']> {
    return Array.from(this.cachedProjects.values()).map((c) => c.payload);
  }

  cacheServerReports(reports: any[]) {
    const cutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const r of reports) {
      const rMs = new Date(`${r.reportDate}T00:00:00.000Z`).getTime();
      if (rMs >= cutoffMs) {
        this.cachedServerReports.set(r.id, r);
      }
    }
  }

  getCachedServerReports(projectId?: string): any[] {
    const list = Array.from(this.cachedServerReports.values());
    return projectId ? list.filter((r) => r.projectId === projectId) : list;
  }
}
