import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule, configureApp } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedDatabase } from '../prisma/seed';
import { testRequest } from './http-test-client';

describe('Spec 05 - Reports and Dashboard E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let ownerToken: string;
  let pmToken: string;
  let staffToken: string;

  let pmUserId: string;
  let staffUserId: string;
  let taxRateId: string;
  let client1Id: string;
  let client2Id: string;
  let project1Id: string;
  let project2Id: string;

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

    const loginOwner = await testRequest(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@example.com', password: 'Password123!' });
    ownerToken = loginOwner.body.accessToken;

    const pmRes = await testRequest(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Faizal PM',
        email: 'pm@example.com',
        password: 'Password123!',
        role: 'PROJECT_MANAGER',
      });
    pmUserId = pmRes.body.id;

    const staffRes = await testRequest(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Kumar Site',
        email: 'staff@example.com',
        password: 'Password123!',
        role: 'SITE_STAFF',
      });
    staffUserId = staffRes.body.id;

    const taxRes = await testRequest(app)
      .get('/api/v1/tax-rates')
      .set('Authorization', `Bearer ${ownerToken}`);
    taxRateId = taxRes.body.items.find((t: any) => t.name === 'SST 6%').id;

    const loginPm = await testRequest(app)
      .post('/api/v1/auth/login')
      .send({ email: 'pm@example.com', password: 'Password123!' });
    pmToken = loginPm.body.accessToken;

    const loginStaff = await testRequest(app)
      .post('/api/v1/auth/login')
      .send({ email: 'staff@example.com', password: 'Password123!' });
    staffToken = loginStaff.body.accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('seeds a known dataset and verifies AC1-AC5 across all 7 report endpoints + Excel export', async () => {
    const api = testRequest(app);

    // 1. Create two clients: Acme Corp (ACM) and Maju Properties (MJP)
    const c1Res = await api
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        code: 'ACM',
        name: 'Acme Corp Sdn Bhd',
        tin: 'C1111111111',
      });
    expect(c1Res.status).toBe(201);
    client1Id = c1Res.body.id;

    const c2Res = await api
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        code: 'MJP',
        name: 'Maju Properties Sdn Bhd',
        tin: 'C2222222222',
      });
    expect(c2Res.status).toBe(201);
    client2Id = c2Res.body.id;

    // 2. Create 3 Quotations:
    // - Q1 (ACM): RM 100,000 + 6% SST = RM 106,000 -> SENT -> ACCEPTED (auto-creates Project P26-001)
    // - Q2 (MJP): RM 50,000 -> SENT (awaiting reply, validUntil 2026-12-31)
    // - Q3 (MJP): RM 20,000 -> SENT -> REJECTED
    const q1Res = await api
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        clientId: client1Id,
        title: 'Main Renovation Contract',
        issueDate: '2026-11-02',
        validUntil: '2026-12-02',
        discountAmount: '0.00',
        sections: [
          {
            title: 'A. Works',
            items: [
              {
                description: 'Main civil works',
                unit: 'LS',
                quantity: '1.000',
                rate: '100000.00',
                taxRateId,
              },
            ],
          },
        ],
      });
    expect(q1Res.status).toBe(201);

    await api
      .post(`/api/v1/quotations/${q1Res.body.id}/send`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const acceptQ1 = await api
      .post(`/api/v1/quotations/${q1Res.body.id}/accept`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        createProject: true,
        projectName: 'Acme Renovation Project',
      });
    expect(acceptQ1.status).toBe(200);
    project1Id = acceptQ1.body.projectId;

    await api
      .patch(`/api/v1/projects/${project1Id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        startDate: '2026-11-02',
        endDate: '2026-11-30',
      });

    // Assign PM and Site Staff to Project 1
    await api
      .put(`/api/v1/projects/${project1Id}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userIds: [pmUserId, staffUserId] });

    // Create a second active project P2 (not assigned to PM)
    const p2Res = await api
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        code: 'P26-002',
        clientId: client2Id,
        name: 'Maju Warehouse Roofing',
        status: 'ACTIVE',
        startDate: '2026-11-02',
      });
    expect(p2Res.status).toBe(201);
    project2Id = p2Res.body.id;

    // Q2: Awaiting reply (RM 50,000.00 no tax)
    const q2Res = await api
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        clientId: client2Id,
        title: 'Car Park Resurfacing',
        issueDate: '2026-11-05',
        validUntil: '2026-12-31',
        discountAmount: '0.00',
        sections: [
          {
            title: 'Resurfacing',
            items: [
              {
                description: 'Asphalt work',
                unit: 'LS',
                quantity: '1.000',
                rate: '50000.00',
                taxRateId: null,
              },
            ],
          },
        ],
      });
    await api
      .post(`/api/v1/quotations/${q2Res.body.id}/send`)
      .set('Authorization', `Bearer ${ownerToken}`);

    // Q3: Rejected (RM 20,000.00)
    const q3Res = await api
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        clientId: client2Id,
        title: 'Signage Structure',
        issueDate: '2026-11-06',
        validUntil: '2026-12-31',
        discountAmount: '0.00',
        sections: [
          {
            title: 'Signage',
            items: [
              {
                description: 'Steel signage',
                unit: 'LS',
                quantity: '1.000',
                rate: '20000.00',
                taxRateId: null,
              },
            ],
          },
        ],
      });
    await api
      .post(`/api/v1/quotations/${q3Res.body.id}/send`)
      .set('Authorization', `Bearer ${ownerToken}`);
    await api
      .post(`/api/v1/quotations/${q3Res.body.id}/reject`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'Budget constraint' });

    // 3. Create & approve VO-01 on Project 1 for RM 20,000.00
    // Revised contract = 100,000 + 20,000 = 120,000.00
    const voRes = await api
      .post(`/api/v1/projects/${project1Id}/variation-orders`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Additional Partition Wall',
        items: [
          {
            description: 'Partition wall',
            unit: 'LS',
            quantity: '1.000',
            rate: '20000.00',
          },
        ],
      });
    expect(voRes.status).toBe(201);
    await api
      .post(`/api/v1/variation-orders/${voRes.body.id}/submit`)
      .set('Authorization', `Bearer ${ownerToken}`);
    await api
      .post(`/api/v1/variation-orders/${voRes.body.id}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`);

    // 4. Create & issue Progress Claim #1 on Project 1 (50% of 100k + 50% of 20k = 60,000 grossToDate)
    // Retention 10% (cap 5% of 120,000 = 6,000.00) -> retentionToDate = 6,000.00
    // Subtotal = 54,000.00, SST 6% = 3,240.00, Total = 57,240.00
    const contractRes = await api
      .get(`/api/v1/projects/${project1Id}/contract`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const contractItems = contractRes.body.items;

    const pc1Res = await api
      .post(`/api/v1/projects/${project1Id}/progress-claims`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(pc1Res.status).toBe(201);

    const updatePc1 = await api
      .put(`/api/v1/invoices/${pc1Res.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        issueDate: '2026-11-10',
        taxRateId,
        claimLines: contractItems.map((ci: any) => ({
          contractItemId: ci.id,
          cumulativePercent: '50.00',
        })),
      });
    expect(updatePc1.status).toBe(200);

    const issuePc1 = await api
      .post(`/api/v1/invoices/${pc1Res.body.id}/issue`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(issuePc1.status).toBe(200);
    expect(issuePc1.body.total).toBe('57240.00');
    expect(issuePc1.body.retentionToDate).toBe('6000.00');

    // 5. Create a DRAFT invoice and a VOID invoice (AC2: must never appear in totals)
    await api
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'SIMPLE',
        clientId: client2Id,
        lines: [{ description: 'Draft item', quantity: '1.000', rate: '99999.00' }],
      });

    const voidCandidate = await api
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'SIMPLE',
        clientId: client2Id,
        issueDate: '2026-11-10',
        lines: [{ description: 'To be voided', quantity: '1.000', rate: '88888.00' }],
      });
    await api
      .post(`/api/v1/invoices/${voidCandidate.body.id}/issue`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    await api
      .post(`/api/v1/invoices/${voidCandidate.body.id}/void`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'Issued in error' });

    // 6. Create an overdue simple invoice on Client 2 (issueDate 2026-09-15 -> dueDate 2026-10-15 -> 35 days overdue as of 2026-11-19 -> 31-60 bucket)
    const overdueInv = await api
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'SIMPLE',
        clientId: client2Id,
        projectId: project2Id,
        issueDate: '2026-09-15',
        lines: [{ description: 'Roofing deposit', quantity: '1.000', rate: '15000.00' }],
      });
    await api
      .post(`/api/v1/invoices/${overdueInv.body.id}/issue`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    // 7. Record a partial payment of RM 27,240.00 on PC-01 (leaving RM 30,000.00 current outstanding on Client 1)
    const payRes = await api
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        clientId: client1Id,
        receivedDate: '2026-11-15',
        method: 'BANK_TRANSFER',
        amount: '27240.00',
        allocations: [{ invoiceId: pc1Res.body.id, amount: '27240.00' }],
      });
    expect(payRes.status).toBe(201);

    // 8. Seed a Daily Report on Project 1 for yesterday (2026-11-18, Wednesday)
    const drId = '01933b8a-0000-7000-8000-000000000501';
    await prisma.dailyReport.create({
      data: {
        id: drId,
        number: 'DR-P26001-20261118',
        projectId: project1Id,
        reportDate: new Date('2026-11-18T00:00:00.000Z'),
        submittedById: staffUserId,
        weather: 'SUNNY',
        workDone: 'Partition framing completed',
        status: 'SUBMITTED',
      },
    });

    // =========================================================================
    // Test 1: Dashboard Report (/api/v1/reports/dashboard) + AC4 timing check
    // =========================================================================
    const t0 = Date.now();
    const dashRes = await api
      .get('/api/v1/reports/dashboard?asOf=2026-11-19')
      .set('Authorization', `Bearer ${ownerToken}`);
    const elapsedMs = Date.now() - t0;
    expect(dashRes.status).toBe(200);
    expect(elapsedMs).toBeLessThan(2000); // AC4

    expect(dashRes.body.activeProjects).toBe(2);
    expect(dashRes.body.quotationsAwaitingReply).toEqual({
      count: 1,
      value: '50000.00',
    });
    expect(dashRes.body.invoicedThisMonth).toBe('57240.00');
    expect(dashRes.body.receivedThisMonth).toBe('27240.00');
    // Total outstanding = 30,000.00 (ACM) + 15,000.00 (MJP) = 45,000.00 (DRAFT & VOID excluded!)
    expect(dashRes.body.totalOutstanding).toBe('45000.00');
    expect(dashRes.body.totalRetentionHeld).toBe('6000.00');
    // Project 1 reported on 2026-11-18, Project 2 did not!
    expect(dashRes.body.projectsWithNoReportYesterday.map((p: any) => p.id)).toEqual([
      project2Id,
    ]);

    // =========================================================================
    // Test 2: Project Summary Report (/api/v1/reports/projects/:id/summary)
    // =========================================================================
    const projSumRes = await api
      .get(`/api/v1/reports/projects/${project1Id}/summary?from=2026-11-16&to=2026-11-19`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(projSumRes.status).toBe(200);
    expect(projSumRes.body.contractSum).toBe('100000.00');
    expect(projSumRes.body.approvedVariations).toBe('20000.00');
    expect(projSumRes.body.claimedToDate).toBe('60000.00');
    expect(projSumRes.body.paidToDate).toBe('27240.00');
    expect(projSumRes.body.outstanding).toBe('30000.00');
    expect(projSumRes.body.retentionHeld).toBe('6000.00');
    expect(projSumRes.body.percentClaimed).toBe('50.00');
    // Mon 16 Nov .. Thu 19 Nov = 4 working days, 1 day with report (18 Nov)
    expect(projSumRes.body.workingDays).toBe(4);
    expect(projSumRes.body.daysWithReports).toBe(1);

    // AC3: PM cannot access Project 2 summary
    const pmForbiddenProj2 = await api
      .get(`/api/v1/reports/projects/${project2Id}/summary`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(pmForbiddenProj2.status).toBe(403);

    // AC3: SITE_STAFF has no access to financial reports
    const staffForbiddenDash = await api
      .get('/api/v1/reports/dashboard')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(staffForbiddenDash.status).toBe(403);

    // =========================================================================
    // Test 3: Receivables Ageing (/api/v1/reports/receivables-ageing)
    // =========================================================================
    const ageingRes = await api
      .get('/api/v1/reports/receivables-ageing?asOf=2026-11-19')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(ageingRes.status).toBe(200);
    expect(ageingRes.body.rows).toHaveLength(2);
    expect(ageingRes.body.totals).toEqual({
      current: '30000.00',
      days1To30: '0.00',
      days31To60: '15000.00',
      days61To90: '0.00',
      days90Plus: '0.00',
      total: '45000.00',
    });

    // =========================================================================
    // Test 4: Quotation Pipeline (/api/v1/reports/quotation-pipeline)
    // =========================================================================
    const pipeRes = await api
      .get('/api/v1/reports/quotation-pipeline?from=2026-11-01&to=2026-11-30')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(pipeRes.status).toBe(200);
    // 1 ACCEPTED (106,000.00), 1 SENT (50,000.00), 1 REJECTED (20,000.00) -> Win rate = 1 / (1 + 1 + 0) = 50.00%
    expect(pipeRes.body.winRate).toBe('50.00');
    const acceptedRow = pipeRes.body.byStatus.find((r: any) => r.status === 'ACCEPTED');
    expect(acceptedRow).toEqual({ status: 'ACCEPTED', count: 1, value: '106000.00' });

    // =========================================================================
    // Test 5: Billing & Collections (/api/v1/reports/billing-collections)
    // =========================================================================
    const bcRes = await api
      .get('/api/v1/reports/billing-collections?from=2026-09-01&to=2026-11-30')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(bcRes.status).toBe(200);
    expect(bcRes.body.months).toEqual([
      { month: '2026-09', invoiced: '15000.00', received: '0.00' },
      { month: '2026-10', invoiced: '0.00', received: '0.00' },
      { month: '2026-11', invoiced: '57240.00', received: '27240.00' },
    ]);
    expect(bcRes.body.totals).toEqual({
      invoiced: '72240.00',
      received: '27240.00',
    });

    // =========================================================================
    // Test 6: Retention Register (/api/v1/reports/retention)
    // =========================================================================
    const retRes = await api
      .get('/api/v1/reports/retention')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(retRes.status).toBe(200);
    expect(retRes.body.rows).toHaveLength(1);
    expect(retRes.body.rows[0].project.id).toBe(project1Id);
    expect(retRes.body.rows[0].held).toBe('6000.00');
    expect(retRes.body.rows[0].released).toBe('0.00');
    expect(retRes.body.rows[0].balance).toBe('6000.00');
    expect(retRes.body.rows[0].expectedReleases).toEqual([
      {
        date: '2026-11-30',
        amount: '3000.00',
        milestone: 'PRACTICAL_COMPLETION',
      },
      {
        date: '2027-11-30',
        amount: '3000.00',
        milestone: 'END_OF_DEFECTS_LIABILITY',
      },
    ]);

    // =========================================================================
    // Test 7: Daily Report Compliance (/api/v1/reports/daily-report-compliance)
    // =========================================================================
    const compRes = await api
      .get('/api/v1/reports/daily-report-compliance?from=2026-11-16&to=2026-11-19')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(compRes.status).toBe(200);
    // PM only sees Project 1 (AC3)
    expect(compRes.body.byProject).toHaveLength(1);
    expect(compRes.body.byProject[0]).toMatchObject({
      expected: 4,
      submitted: 1,
      compliancePercent: '25.00',
    });
    expect(compRes.body.bySiteStaff).toHaveLength(1);
    expect(compRes.body.bySiteStaff[0]).toMatchObject({
      expected: 4,
      submitted: 1,
      compliancePercent: '25.00',
    });

    // =========================================================================
    // Test 8: Excel Export (?format=xlsx) on any report endpoint (AC5 / T08)
    // =========================================================================
    const xlsxRes = await api
      .get('/api/v1/reports/receivables-ageing?asOf=2026-11-19&format=xlsx')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(xlsxRes.status).toBe(200);
    expect(xlsxRes.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(xlsxRes.headers['content-disposition']).toContain('attachment; filename=');
    // Valid ZIP/OpenXML files start with "PK\x03\x04"
    expect(Buffer.isBuffer(xlsxRes.body)).toBe(true);
    expect(xlsxRes.body.slice(0, 2).toString('utf8')).toBe('PK');
  });
});
