import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { testRequest } from './http-test-client';
import { AppModule, configureApp } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedDatabase } from '../prisma/seed';

describe('Spec 02 - Quotations e2e (AC1 - AC9)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let clientId: string;
  let projectId: string;
  let taxRateId: string;

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

    const loginRes = await testRequest(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@example.com', password: 'Password123!' });
    ownerToken = loginRes.body.accessToken;

    const taxRes = await testRequest(app)
      .get('/api/v1/tax-rates')
      .set('Authorization', `Bearer ${ownerToken}`);
    taxRateId = taxRes.body.items.find((t: any) => t.name === 'SST 6%').id;

    const clientRes = await testRequest(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Klinik Sihat', email: 'klinik@example.com' });
    clientId = clientRes.body.id;

    const projRes = await testRequest(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        code: 'P-2026-008',
        name: 'Clinic renovation',
        clientId,
      });
    projectId = projRes.body.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('AC1, AC2, AC8, AC9: creates DRAFT with number, recalculates totals, enforces item requirement on send', async () => {
    // Empty quotation cannot be sent (AC9)
    const emptyRes = await testRequest(app)
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        clientId,
        projectId,
        title: 'Empty Draft',
        sections: [],
      });
    expect(emptyRes.status).toBe(201);
    expect(emptyRes.body.number).toMatch(/^QT-\d{2}-\d{3}-[A-Z0-9]+$/);
    expect(emptyRes.body.displayNumber).toMatch(/^QT-\d{2}-\d{3}-[A-Z0-9]+-R0$/);

    const sendEmptyRes = await testRequest(app)
      .post(`/api/v1/quotations/${emptyRes.body.id}/send`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(sendEmptyRes.status).toBe(422);
    expect(sendEmptyRes.body.code).toBe('QUOTATION_HAS_NO_ITEMS');

    // Update with sections and items, verify server recalculation and order preservation (AC2, AC8)
    const putRes = await testRequest(app)
      .put(`/api/v1/quotations/${emptyRes.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        clientId,
        projectId,
        title: 'Clinic Renovation Quotation',
        issueDate: '2026-11-12',
        validUntil: '2026-12-31',
        discountAmount: '1000.00',
        sections: [
          {
            title: 'A. Demolition',
            items: [
              { description: 'Remove partitions', unit: 'm2', quantity: '100.000', rate: '40.00', taxRateId },
              { description: 'Debris disposal', unit: 'trip', quantity: '2.000', rate: '500.00', taxRateId },
            ],
          },
          {
            title: 'B. Electrical',
            items: [
              { description: 'Wiring & DB', unit: 'LS', quantity: '1.000', rate: '5000.00', taxRateId },
            ],
          },
        ],
      });

    expect(putRes.status).toBe(200);
    // Subtotal = 4000 + 1000 + 5000 = 10000.00
    // Discount = 1000.00 -> taxable = 9000.00 @ 6% = 540.00 -> total = 9540.00
    expect(putRes.body.subtotal).toBe('10000.00');
    expect(putRes.body.discountAmount).toBe('1000.00');
    expect(putRes.body.taxAmount).toBe('540.00');
    expect(putRes.body.total).toBe('9540.00');
    expect(putRes.body.sections[0].title).toBe('A. Demolition');
    expect(putRes.body.sections[0].items[1].description).toBe('Debris disposal');
  });

  it('AC3, AC4, AC5, AC6, AC7: send stores PDF, blocks edits (409 QUOTATION_NOT_EDITABLE), revises, accepts latest, and computes EXPIRED', async () => {
    const createRes = await testRequest(app)
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        clientId,
        projectId,
        title: 'Main Contract Quotation',
        issueDate: '2026-11-15',
        validUntil: '2027-12-31',
        sections: [
          {
            title: 'A. Structural',
            items: [
              { description: 'RC Beams', unit: 'm3', quantity: '10.000', rate: '1000.00', taxRateId },
            ],
          },
        ],
      });
    expect(createRes.status).toBe(201);
    const rev0Id = createRes.body.id;
    const origNumber = createRes.body.number;

    // Send rev 0 (AC7)
    const sendRes = await testRequest(app)
      .post(`/api/v1/quotations/${rev0Id}/send`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(sendRes.status).toBe(200);
    expect(sendRes.body.status).toBe('SENT');
    expect(sendRes.body.pdfFileId).toBeTruthy();

    // AC3: Editing a SENT quotation returns 409 QUOTATION_NOT_EDITABLE
    const editSentRes = await testRequest(app)
      .put(`/api/v1/quotations/${rev0Id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        clientId,
        title: 'Attempted Edit',
        sections: [],
      });
    expect(editSentRes.status).toBe(409);
    expect(editSentRes.body.code).toBe('QUOTATION_NOT_EDITABLE');

    // AC4: Revise SENT quotation -> creates DRAFT with revisionNo 1 and marks rev 0 SUPERSEDED
    const rev1Res = await testRequest(app)
      .post(`/api/v1/quotations/${rev0Id}/revise`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(rev1Res.status).toBe(201);
    expect(rev1Res.body.number).toBe(origNumber);
    expect(rev1Res.body.revisionNo).toBe(1);
    expect(rev1Res.body.status).toBe('DRAFT');
    const rev1Id = rev1Res.body.id;

    const rev0Check = await testRequest(app)
      .get(`/api/v1/quotations/${rev0Id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(rev0Check.body.status).toBe('SUPERSEDED');

    // AC5: Accepting old revision fails with 409 QUOTATION_NOT_LATEST_REVISION
    const acceptOldRes = await testRequest(app)
      .post(`/api/v1/quotations/${rev0Id}/accept`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(acceptOldRes.status).toBe(409);
    expect(acceptOldRes.body.code).toBe('QUOTATION_NOT_LATEST_REVISION');

    // Send and accept rev 1
    await testRequest(app)
      .post(`/api/v1/quotations/${rev1Id}/send`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const acceptRev1 = await testRequest(app)
      .post(`/api/v1/quotations/${rev1Id}/accept`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(acceptRev1.status).toBe(200);
    expect(acceptRev1.body.status).toBe('ACCEPTED');

    // Convert accepted quotation into project contract
    const contractRes = await testRequest(app)
      .post(`/api/v1/projects/${projectId}/contract/from-quotation`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ quotationId: rev1Id });
    expect(contractRes.status).toBe(201);
    expect(contractRes.body.originalSum).toBe('10000.00');

    // AC6: SENT quotation with past validUntil is returned as EXPIRED
    const expiredCreate = await testRequest(app)
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        clientId,
        title: 'Past Validity Quotation',
        issueDate: '2025-01-01',
        validUntil: '2025-01-31',
        sections: [
          {
            title: 'A',
            items: [{ description: 'Test', quantity: '1.000', rate: '100.00' }],
          },
        ],
      });
    const expSend = await testRequest(app)
      .post(`/api/v1/quotations/${expiredCreate.body.id}/send`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(expSend.status).toBe(200);
    expect(expSend.body.status).toBe('EXPIRED');
  });
});
