import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { v7 as uuidv7 } from 'uuid';
import { testRequest } from './http-test-client';
import { AppModule, configureApp } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedDatabase } from '../prisma/seed';

describe('Spec 04 - Invoicing, Progress Claims, Payments & Full Document Link Flow (AC1 - AC11)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
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
  });

  afterAll(async () => {
    await app?.close();
  });

  it('Walks the full Acme Corp (ACM) Document Link Flow end-to-end and verifies AC1-AC11', async () => {
    // 1. CLIENT (ACM)
    const clientRes = await testRequest(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        code: 'ACM',
        name: 'Acme Corp Sdn Bhd',
        registrationNo: '202001099999',
        tin: 'C9999999990',
        address: '100 Jalan Acme, Kuala Lumpur',
      });
    expect(clientRes.status).toBe(201);
    expect(clientRes.body.code).toBe('ACM');
    const clientId = clientRes.body.id;

    // 2. QUOTATION: QT-26-001-ACM-R0 -> R1
    const qR0Res = await testRequest(app)
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        clientId,
        title: 'Acme HQ Renovation',
        issueDate: '2026-11-10',
        sections: [
          {
            title: 'A. Main Works',
            items: [
              {
                description: 'Structural & Civil Works',
                unit: 'LS',
                quantity: '1.000',
                rate: '120000.00',
                taxRateId,
              },
            ],
          },
        ],
      });
    expect(qR0Res.status).toBe(201);
    expect(qR0Res.body.displayNumber).toBe('QT-26-001-ACM-R0');

    // Send R0, then revise to R1 (negotiated to 100,000.00)
    await testRequest(app)
      .post(`/api/v1/quotations/${qR0Res.body.id}/send`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const qR1Res = await testRequest(app)
      .post(`/api/v1/quotations/${qR0Res.body.id}/revise`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(qR1Res.status).toBe(201);
    expect(qR1Res.body.displayNumber).toBe('QT-26-001-ACM-R1');
    const qR1Id = qR1Res.body.id;

    await testRequest(app)
      .put(`/api/v1/quotations/${qR1Id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        clientId,
        title: 'Acme HQ Renovation',
        issueDate: '2026-11-12',
        sections: [
          {
            title: 'A. Main Works',
            items: [
              {
                description: 'Structural & Civil Works',
                unit: 'LS',
                quantity: '1.000',
                rate: '100000.00',
                taxRateId,
              },
            ],
          },
        ],
      })
      .expect(200);

    await testRequest(app)
      .post(`/api/v1/quotations/${qR1Id}/send`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    // 3. ACCEPT R1 -> Creates Project P26-001 with Contract Quote = QT-26-001-ACM-R1 (AC1)
    const acceptRes = await testRequest(app)
      .post(`/api/v1/quotations/${qR1Id}/accept`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ createProject: true });
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.projectId).toBeTruthy();
    const projectId = acceptRes.body.projectId;

    const projRes = await testRequest(app)
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(projRes.status).toBe(200);
    expect(projRes.body.code).toBe('P26-001');
    expect(projRes.body.contractQuoteRef).toBe('QT-26-001-ACM-R1');
    expect(projRes.body.contractSum).toBe('100000.00');

    // AC1: Attempting to convert contract a second time returns 409 CONTRACT_ALREADY_EXISTS
    const dupContract = await testRequest(app)
      .post(`/api/v1/projects/${projectId}/contract/from-quotation`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ quotationId: qR1Id });
    expect(dupContract.status).toBe(409);
    expect(dupContract.body.code).toBe('CONTRACT_ALREADY_EXISTS');

    const contractRes = await testRequest(app)
      .get(`/api/v1/projects/${projectId}/contract`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(contractRes.status).toBe(200);
    const mainContractItemId = contractRes.body.items[0].id;

    // 4. SITE WORK & REPORTS: DR-P26001-20261119, IR-P26001-001, PR-P26001-001
    const presignRes = await testRequest(app)
      .post('/api/v1/files/presign')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        fileName: 'site.jpg',
        mimeType: 'image/jpeg',
        size: 50000,
        purpose: 'DAILY_REPORT_PHOTO',
      });

    const todayStr = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
    const drRes = await testRequest(app)
      .put(`/api/v1/daily-reports/${uuidv7()}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        projectId,
        reportDate: todayStr,
        weather: 'SUNNY',
        workDone: '30% structural works completed',
        manpower: [{ trade: 'Carpenter', headcount: 6 }],
        photos: [{ fileId: presignRes.body.fileId, caption: 'Site progress' }],
      });
    expect(drRes.status).toBe(201);
    expect(drRes.body.number).toBe(`DR-P26001-${todayStr.replace(/-/g, '')}`);

    const irRes = await testRequest(app)
      .post(`/api/v1/projects/${projectId}/inspection-reports`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'First Stage Rebar Inspection',
        findings: 'Passed all structural checks',
        status: 'PASSED',
      });
    expect(irRes.status).toBe(201);
    expect(irRes.body.number).toBe('IR-P26001-001');

    // End of month QS/PM issues Progress Report PR-P26001-001 (30% completed)
    const prRes = await testRequest(app)
      .post(`/api/v1/projects/${projectId}/progress-reports`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        summary: 'Month 1 certified progress (30%)',
        lines: [{ contractItemId: mainContractItemId, cumulativePercent: '30.00' }],
      });
    expect(prRes.status).toBe(201);
    expect(prRes.body.number).toBe('PR-P26001-001');
    const progressReportId = prRes.body.id;

    // 5. INVOICE ISSUED (Progress Claim #1 backed by PR-P26001-001)
    const pc1Draft = await testRequest(app)
      .post(`/api/v1/projects/${projectId}/progress-claims`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ progressReportId, issueDate: '2026-11-19' });
    expect(pc1Draft.status).toBe(201);
    expect(pc1Draft.body.claimNo).toBe(1);
    expect(pc1Draft.body.grossToDate).toBe('30000.00');
    expect(pc1Draft.body.retentionToDate).toBe('3000.00'); // 10% of 30,000
    expect(pc1Draft.body.subtotal).toBe('27000.00');
    expect(pc1Draft.body.taxAmount).toBe('1620.00'); // 6% of 27,000
    expect(pc1Draft.body.total).toBe('28620.00');
    expect(pc1Draft.body.projectCodeRef).toBe('P26-001');
    expect(pc1Draft.body.quotePoRef).toBe('QT-26-001-ACM-R1');
    expect(pc1Draft.body.claimReportRef).toBe('PC-01 / PR-P26001-001');
    expect(pc1Draft.body.referenceSummary).toBe('P26-001 / PC-01 / PR-P26001-001');

    // AC5: Cannot create a second DRAFT progress claim while one exists
    const dupDraft = await testRequest(app)
      .post(`/api/v1/projects/${projectId}/progress-claims`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(dupDraft.status).toBe(409);
    expect(dupDraft.body.code).toBe('DRAFT_CLAIM_EXISTS');

    // Issue Progress Claim #1 -> Unbroken Tax Invoice INV-26-0001 (AC6, AC11)
    const pc1Issued = await testRequest(app)
      .post(`/api/v1/invoices/${pc1Draft.body.id}/issue`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(pc1Issued.status).toBe(200);
    expect(pc1Issued.body.number).toBe('INV-26-0001');
    expect(pc1Issued.body.status).toBe('ISSUED');
    expect(pc1Issued.body.buyer.tin).toBe('C9999999990');
    expect(pc1Issued.body.pdfFileId).toBeTruthy();

    // 6. VARIATION ORDER: QT-26-001-ACM-VO01 (AC2)
    const voDraft = await testRequest(app)
      .post(`/api/v1/projects/${projectId}/variation-orders`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Additional Acoustic Partition Wall',
        reason: 'Client requested extra meeting room partition',
        items: [
          {
            description: 'Supply & install acoustic partition',
            unit: 'LS',
            quantity: '1.000',
            rate: '20000.00',
          },
        ],
      });
    expect(voDraft.status).toBe(201);
    expect(voDraft.body.number).toBe('QT-26-001-ACM-VO01');
    expect(voDraft.body.shortRef).toBe('VO-01');
    expect(voDraft.body.total).toBe('20000.00');

    await testRequest(app)
      .post(`/api/v1/variation-orders/${voDraft.body.id}/submit`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const voApproved = await testRequest(app)
      .post(`/api/v1/variation-orders/${voDraft.body.id}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(voApproved.status).toBe(200);
    expect(voApproved.body.status).toBe('APPROVED');

    // Verify contract now includes VO-01 item and currentSum = 120,000.00
    const updatedContract = await testRequest(app)
      .get(`/api/v1/projects/${projectId}/contract`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(updatedContract.body.currentSum).toBe('120000.00');
    const voContractItem = updatedContract.body.items.find(
      (i: any) => i.variationOrderId === voDraft.body.id,
    );
    expect(voContractItem).toBeTruthy();

    // 7. PROGRESS CLAIM #2 (Includes VO-01 work -> Ref: P26-001 / PC-02 / VO-01)
    const pc2Draft = await testRequest(app)
      .post(`/api/v1/projects/${projectId}/progress-claims`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ issueDate: '2026-11-25' });
    expect(pc2Draft.status).toBe(201);
    expect(pc2Draft.body.claimNo).toBe(2);

    const pc2Updated = await testRequest(app)
      .put(`/api/v1/invoices/${pc2Draft.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        claimLines: [
          { contractItemId: mainContractItemId, cumulativePercent: '60.00' }, // 60,000
          { contractItemId: voContractItem.id, cumulativePercent: '100.00' }, // 20,000
        ],
      });
    expect(pc2Updated.status).toBe(200);
    // Gross = 80,000.00; 10% retention = 8,000 is capped at 5% of 120,000 = 6,000.00!
    // Net to date = 74,000.00; less previous net 27,000.00 = 47,000.00
    expect(pc2Updated.body.grossToDate).toBe('80000.00');
    expect(pc2Updated.body.retentionToDate).toBe('6000.00');
    expect(pc2Updated.body.subtotal).toBe('47000.00');
    expect(pc2Updated.body.claimReportRef).toBe('PC-02 / VO-01');
    expect(pc2Updated.body.referenceSummary).toBe('P26-001 / PC-02 / VO-01');

    const pc2Issued = await testRequest(app)
      .post(`/api/v1/invoices/${pc2Draft.body.id}/issue`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(pc2Issued.status).toBe(200);
    expect(pc2Issued.body.number).toBe('INV-26-0002');

    // 8. RETENTION RELEASE (INV-26-0003 -> Ref: P26-001 / RET) (AC9)
    // Trying to release more than 6,000.00 held fails with 422 RETENTION_RELEASE_EXCEEDS_HELD
    const excessRet = await testRequest(app)
      .post(`/api/v1/projects/${projectId}/retention-releases`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ amount: '7000.00' });
    expect(excessRet.status).toBe(422);
    expect(excessRet.body.code).toBe('RETENTION_RELEASE_EXCEEDS_HELD');

    // Release 50% (3,000.00) at practical completion
    const retDraft = await testRequest(app)
      .post(`/api/v1/projects/${projectId}/retention-releases`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ amount: '3000.00', issueDate: '2026-11-28' });
    expect(retDraft.status).toBe(201);
    expect(retDraft.body.referenceSummary).toBe('P26-001 / RET');

    const retIssued = await testRequest(app)
      .post(`/api/v1/invoices/${retDraft.body.id}/issue`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(retIssued.status).toBe(200);
    expect(retIssued.body.number).toBe('INV-26-0003');

    // 9. PAYMENTS & ALLOCATIONS (AC8)
    // Partial payment of 10,000.00 on INV-26-0001 (total 28,620.00) -> PARTIALLY_PAID
    const pay1 = await testRequest(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        clientId,
        receivedDate: '2026-11-20',
        method: 'BANK_TRANSFER',
        reference: 'IBG-001',
        amount: '10000.00',
        allocations: [{ invoiceId: pc1Issued.body.id, amount: '10000.00' }],
      });
    expect(pay1.status).toBe(201);

    const checkPartPaid = await testRequest(app)
      .get(`/api/v1/invoices/${pc1Issued.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(checkPartPaid.body.status).toBe('PARTIALLY_PAID');
    expect(checkPartPaid.body.amountPaid).toBe('10000.00');

    // Credit note of 1,000.00 + 6% tax = 1,060.00 against INV-26-0001
    const cnRes = await testRequest(app)
      .post(`/api/v1/invoices/${pc1Issued.body.id}/credit-notes`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        issueDate: '2026-11-21',
        reason: 'Agreed minor defect allowance',
        subtotal: '1000.00',
        taxRateId,
      });
    expect(cnRes.status).toBe(201);
    expect(cnRes.body.number).toBe('CN-26-0001');
    expect(cnRes.body.total).toBe('1060.00');

    // Remaining balance on INV-26-0001 is 28,620 - 10,000 - 1,060 = 17,560.00
    const pay2 = await testRequest(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        clientId,
        receivedDate: '2026-11-22',
        method: 'BANK_TRANSFER',
        reference: 'IBG-002',
        amount: '17560.00',
        allocations: [{ invoiceId: pc1Issued.body.id, amount: '17560.00' }],
      });
    expect(pay2.status).toBe(201);

    const checkPaid = await testRequest(app)
      .get(`/api/v1/invoices/${pc1Issued.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(checkPaid.body.status).toBe('PAID');

    // 10. CSV Exports
    const invCsv = await testRequest(app)
      .get('/api/v1/exports/invoices.csv?from=2026-11-01&to=2026-11-30')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(invCsv.status).toBe(200);
    expect(invCsv.text).toContain('INV-26-0001');
    expect(invCsv.text).toContain('INV-26-0002');
    expect(invCsv.text).toContain('INV-26-0003');
    expect(invCsv.text).toContain('PC-01 / PR-P26001-001');
  });
});
