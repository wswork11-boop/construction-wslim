import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { testRequest } from './http-test-client';
import { v7 as uuidv7 } from 'uuid';
import { AppModule, configureApp } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedDatabase } from '../prisma/seed';

function getKlDateOffset(daysOffset: number): string {
  const now = new Date();
  const klMs = now.getTime() + 8 * 60 * 60 * 1000 + daysOffset * 24 * 60 * 60 * 1000;
  return new Date(klMs).toISOString().slice(0, 10);
}

describe('Spec 03 - Daily Reports e2e (AC3, AC4, AC5, AC8, AC9, AC10)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let staffToken: string;
  let staffId: string;
  let memberProjectId: string;
  let otherProjectId: string;
  let uploadedFileId: string;

  beforeAll(async () => {
    process.env.USE_IN_MEMORY_DB = 'true';
    process.env.SEED_OWNER_EMAIL = 'owner@example.com';
    process.env.SEED_OWNER_PASSWORD = 'Password123!';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    await seedDatabase(prisma as any);

    const ownerLogin = await testRequest(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@example.com', password: 'Password123!' });
    ownerToken = ownerLogin.body.accessToken;

    const staffRes = await testRequest(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: 'site@example.com',
        name: 'Kumar',
        role: 'SITE_STAFF',
        password: 'Password123!',
      });
    staffId = staffRes.body.id;

    const staffLogin = await testRequest(app)
      .post('/api/v1/auth/login')
      .send({ email: 'site@example.com', password: 'Password123!' });
    staffToken = staffLogin.body.accessToken;

    const clientRes = await testRequest(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Maju Properties Sdn Bhd' });
    const clientId = clientRes.body.id;

    const p1 = await testRequest(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ code: 'P-2026-101', name: 'Member Project', clientId, status: 'ACTIVE' });
    memberProjectId = p1.body.id;

    const p2 = await testRequest(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ code: 'P-2026-102', name: 'Other Project', clientId, status: 'ACTIVE' });
    otherProjectId = p2.body.id;

    await testRequest(app)
      .put(`/api/v1/projects/${memberProjectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userIds: [staffId] });

    const presignRes = await testRequest(app)
      .post('/api/v1/files/presign')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        fileName: 'site-photo-1.jpg',
        mimeType: 'image/jpeg',
        size: 120000,
        purpose: 'DAILY_REPORT_PHOTO',
      });
    uploadedFileId = presignRes.body.fileId;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('AC3 & AC4: idempotent PUT creates once on retry, and blocks duplicate report with another ID for same project/date/user', async () => {
    const reportId = uuidv7();
    const today = getKlDateOffset(0);
    const payload = {
      projectId: memberProjectId,
      reportDate: today,
      weather: 'CLOUDY',
      workDone: 'Completed formwork and casting for L1 columns.',
      issues: 'Sand delivery arrived 2 hours late.',
      nextDayPlan: 'Strip column formwork.',
      latitude: 3.2101,
      longitude: 101.5632,
      manpower: [
        { trade: 'Carpenter', headcount: 4 },
        { trade: 'Bricklayer', headcount: 5 },
      ],
      photos: [{ fileId: uploadedFileId, caption: 'L1 columns' }],
    };

    const firstPut = await testRequest(app)
      .put(`/api/v1/daily-reports/${reportId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send(payload);
    expect(firstPut.status).toBe(201);
    expect(firstPut.body.id).toBe(reportId);

    // AC3: Retrying the same PUT returns 200 and keeps exactly one report
    const retryPut = await testRequest(app)
      .put(`/api/v1/daily-reports/${reportId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send(payload);
    expect(retryPut.status).toBe(200);

    const listRes = await testRequest(app)
      .get(`/api/v1/daily-reports?projectId=${memberProjectId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(listRes.body.total).toBe(1);

    // AC4: Trying to create another report with a different ID for same project/date/user returns 409 DAILY_REPORT_ALREADY_EXISTS
    const secondId = uuidv7();
    const dupSlotRes = await testRequest(app)
      .put(`/api/v1/daily-reports/${secondId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send(payload);
    expect(dupSlotRes.status).toBe(409);
    expect(dupSlotRes.body.code).toBe('DAILY_REPORT_ALREADY_EXISTS');
    expect(dupSlotRes.body.details.existingId).toBe(reportId);
  });

  it('AC5: locks editing after report is REVIEWED', async () => {
    const reportId = uuidv7();
    const yesterday = getKlDateOffset(-1);
    const payload = {
      projectId: memberProjectId,
      reportDate: yesterday,
      weather: 'SUNNY',
      workDone: 'Brickwall works',
      manpower: [{ trade: 'Bricklayer', headcount: 6 }],
      photos: [{ fileId: uploadedFileId, caption: 'Brickwall' }],
    };

    await testRequest(app)
      .put(`/api/v1/daily-reports/${reportId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send(payload)
      .expect(201);

    // Review by OWNER
    const reviewRes = await testRequest(app)
      .post(`/api/v1/daily-reports/${reportId}/review`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.status).toBe('REVIEWED');
    expect(reviewRes.body.isEditable).toBe(false);

    // Author tries to edit reviewed report -> 409 DAILY_REPORT_LOCKED
    const editLocked = await testRequest(app)
      .put(`/api/v1/daily-reports/${reportId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ ...payload, workDone: 'Edited after review' });
    expect(editLocked.status).toBe(409);
    expect(editLocked.body.code).toBe('DAILY_REPORT_LOCKED');
  });

  it('AC8 & AC9: blocks non-member project (403) and out-of-range reportDate (422)', async () => {
    const today = getKlDateOffset(0);
    // AC8: Non-member project
    const nonMemRes = await testRequest(app)
      .put(`/api/v1/daily-reports/${uuidv7()}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        projectId: otherProjectId,
        reportDate: today,
        weather: 'SUNNY',
        workDone: 'Unauthorized project',
        manpower: [],
        photos: [{ fileId: uploadedFileId }],
      });
    expect(nonMemRes.status).toBe(403);
    expect(nonMemRes.body.code).toBe('NOT_PROJECT_MEMBER');

    // AC9: Future date -> 422 REPORT_DATE_OUT_OF_RANGE
    const tomorrow = getKlDateOffset(1);
    const futureRes = await testRequest(app)
      .put(`/api/v1/daily-reports/${uuidv7()}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        projectId: memberProjectId,
        reportDate: tomorrow,
        weather: 'SUNNY',
        workDone: 'Future work',
        manpower: [],
        photos: [{ fileId: uploadedFileId }],
      });
    expect(futureRes.status).toBe(422);
    expect(futureRes.body.code).toBe('REPORT_DATE_OUT_OF_RANGE');

    // AC9: 3 days back -> 422 REPORT_DATE_OUT_OF_RANGE
    const threeDaysAgo = getKlDateOffset(-3);
    const oldRes = await testRequest(app)
      .put(`/api/v1/daily-reports/${uuidv7()}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        projectId: memberProjectId,
        reportDate: threeDaysAgo,
        weather: 'SUNNY',
        workDone: 'Too old work',
        manpower: [],
        photos: [{ fileId: uploadedFileId }],
      });
    expect(oldRes.status).toBe(422);
    expect(oldRes.body.code).toBe('REPORT_DATE_OUT_OF_RANGE');
  });

  it('AC10: exports site report PDF containing report details and no prices', async () => {
    const from = getKlDateOffset(-2);
    const to = getKlDateOffset(0);
    const pdfRes = await testRequest(app)
      .get(`/api/v1/projects/${memberProjectId}/site-report.pdf?from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
    const pdfString = Buffer.from(pdfRes.body).toString('utf8');
    expect(pdfString).toContain('%PDF-1.4');
    expect(pdfString).toContain('P-2026-101');
  });
});
