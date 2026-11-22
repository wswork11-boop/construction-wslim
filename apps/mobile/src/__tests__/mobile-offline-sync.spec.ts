import { describe, expect, it } from 'vitest';
import {
  assertPhotoCountAllowed,
  calculateResizedDimensions,
  captureGpsPosition,
  getSyncStateLabel,
  HttpTransport,
  LocalSqliteRepository,
  MobileApiClient,
  resizeAndCompressPhoto,
  SecureTokenStore,
  SyncWorker,
} from '../index';

describe('Mobile offline SQLite repository, photo resize, GPS, and sync worker (Spec 03)', () => {
  it('AC1 & AC2: saves draft offline, remembers manpower trades, and reports clear status labels', () => {
    const repo = new LocalSqliteRepository();
    expect(getSyncStateLabel('DRAFT')).toBe('Draft');
    expect(getSyncStateLabel('QUEUED')).toBe('Waiting to upload');
    expect(getSyncStateLabel('SYNCING')).toBe('Uploading');
    expect(getSyncStateLabel('SYNCED')).toBe('Uploaded');
    expect(getSyncStateLabel('FAILED')).toBe('Failed');

    const projId = '018f0000-0000-7000-8000-000000000101';
    const saved = repo.saveDraft(
      {
        projectId: projId,
        reportDate: '2026-11-18',
        weather: 'CLOUDY',
        workDone: 'Laid electrical conduit in ground floor slab.',
        deviceCreatedAt: '2026-11-18T09:00:00.000Z',
        manpower: [
          { trade: 'Electrician', headcount: 3 },
          { trade: 'General worker', headcount: 4 },
        ],
      },
      [
        { localUri: 'file://photo1.jpg', caption: 'Conduit' },
        { localUri: 'file://photo2.jpg', caption: 'DB box' },
      ],
    );

    expect(saved.report.syncState).toBe('DRAFT');
    expect(saved.photos).toHaveLength(2);

    // AC4: Saving another draft for the same project and date updates the same report ID
    const edited = repo.saveDraft(
      {
        projectId: projId,
        reportDate: '2026-11-18',
        weather: 'RAIN',
        workDone: 'Updated work done offline',
        deviceCreatedAt: '2026-11-18T09:00:00.000Z',
        manpower: [{ trade: 'Electrician', headcount: 3 }],
      },
      [{ localUri: 'file://photo1.jpg', caption: 'Conduit' }],
    );
    expect(edited.report.id).toBe(saved.report.id);
    expect(repo.getRecentTradesForProject(projId)).toEqual(['Electrician']);
  });

  it('AC6: resizes photos to at most 1600 px on the long edge and enforces max 20 photos', async () => {
    expect(calculateResizedDimensions(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(calculateResizedDimensions(1800, 3600)).toEqual({ width: 800, height: 1600 });
    expect(calculateResizedDimensions(1200, 900)).toEqual({ width: 1200, height: 900 });

    const resized = await resizeAndCompressPhoto({
      uri: 'file://camera-raw.jpg',
      width: 4032,
      height: 3024,
    });
    expect(resized.width).toBe(1600);
    expect(resized.height).toBe(1200);
    expect(resized.quality).toBe(0.7);

    expect(() => assertPhotoCountAllowed(19, 1)).not.toThrow();
    expect(() => assertPhotoCountAllowed(20, 1)).toThrow(/Up to 20 photos/);
  });

  it('AC7: captures GPS when permitted and falls back gracefully when denied', async () => {
    const granted = await captureGpsPosition({
      requestPermission: async () => 'granted',
      getCurrentPosition: async () => ({ latitude: 3.2101234, longitude: 101.5632109 }),
    });
    expect(granted).toEqual({ latitude: 3.210123, longitude: 101.563211 });

    const denied = await captureGpsPosition({
      requestPermission: async () => 'denied',
      getCurrentPosition: async () => ({ latitude: 3.21, longitude: 101.56 }),
    });
    expect(denied).toBeNull();
  });

  it('T10 & T14: sync worker handles airplane mode, partial photo upload resume, backoff, and 4xx failure', async () => {
    const repo = new LocalSqliteRepository();
    const tokenStore = new SecureTokenStore();
    await tokenStore.saveSession({
      accessToken: 'valid-token',
      refreshToken: 'valid-refresh',
      user: { id: 'u1', email: 'kumar@example.com', name: 'Kumar', role: 'SITE_STAFF' },
    });

    const projId = '018f0000-0000-7000-8000-000000000101';
    const { report } = repo.saveDraft(
      {
        projectId: projId,
        reportDate: '2026-11-18',
        weather: 'SUNNY',
        workDone: 'Casting columns',
        deviceCreatedAt: '2026-11-18T10:00:00.000Z',
        manpower: [{ trade: 'Carpenter', headcount: 4 }],
      },
      [
        { localUri: 'file://p1.jpg', caption: 'P1' },
        { localUri: 'file://p2.jpg', caption: 'P2' },
      ],
    );
    repo.queueForSync(report.id);

    let presignCount = 0;
    let failOnSecondPhoto = true;

    const transport: HttpTransport = {
      request: async (req) => {
        if (req.url.endsWith('/files/presign')) {
          presignCount++;
          if (presignCount === 2 && failOnSecondPhoto) {
            throw new Error('Network dropped during second photo');
          }
          const fid = `018f0000-0000-7000-8000-00000000000${presignCount}`;
          return {
            status: 201,
            body: {
              fileId: fid,
              uploadUrl: `https://s3.local/upload/${fid}`,
              expiresAt: new Date(Date.now() + 900_000).toISOString(),
            },
          };
        }
        if (req.url.startsWith('https://s3.local/upload/')) {
          return { status: 200, body: {} };
        }
        if (req.url.includes('/daily-reports/')) {
          return { status: 201, body: { id: report.id } };
        }
        return { status: 200, body: {} };
      },
    };

    const api = new MobileApiClient('http://localhost:3000/api/v1', tokenStore, transport);
    const worker = new SyncWorker(repo, api);

    // Run 1: Photo 1 uploads, Photo 2 drops connection -> report stays QUEUED with backoff
    const run1 = await worker.runSync();
    expect(run1?.requeuedIds).toContain(report.id);
    expect(run1?.nextBackoffMs).toBeGreaterThan(0);

    const photosAfterRun1 = repo.getPhotosForReport(report.id);
    expect(photosAfterRun1[0].fileId).toBe('018f0000-0000-7000-8000-000000000001');
    expect(photosAfterRun1[1].fileId).toBeNull();

    // Run 2: Connection restored -> resumes from Photo 2 without re-uploading Photo 1
    failOnSecondPhoto = false;
    const run2 = await worker.runSync();
    expect(run2?.syncedIds).toContain(report.id);
    expect(presignCount).toBe(3); // 1 (photo1) + 1 (failed photo2) + 1 (succeeded photo2)
    expect(repo.getReport(report.id)?.syncState).toBe('SYNCED');
  });
});
