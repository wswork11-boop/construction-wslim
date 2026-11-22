import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule, configureApp } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedDatabase } from '../prisma/seed';
import { testRequest } from './http-test-client';

describe('Spec 07 - Project & Company Expenses (Job Costing) E2E (AC1 - AC8)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let ownerToken: string;
  let pmToken: string;
  let staffToken: string;

  let pmUserId: string;
  let taxRateId: string;
  let clientId: string;
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

    const api = testRequest(app);

    const loginOwner = await api
      .post('/api/v1/auth/login')
      .send({ email: 'owner@example.com', password: 'Password123!' });
    ownerToken = loginOwner.body.accessToken;

    const pmRes = await api
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Faizal PM',
        email: 'pm@example.com',
        password: 'Password123!',
        role: 'PROJECT_MANAGER',
      });
    pmUserId = pmRes.body.id;

    await api
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Kumar Site',
        email: 'staff@example.com',
        password: 'Password123!',
        role: 'SITE_STAFF',
      });

    const taxRes = await api
      .get('/api/v1/tax-rates')
      .set('Authorization', `Bearer ${ownerToken}`);
    taxRateId = taxRes.body.items.find((t: any) => t.name === 'SST 6%').id;

    const loginPm = await api
      .post('/api/v1/auth/login')
      .send({ email: 'pm@example.com', password: 'Password123!' });
    pmToken = loginPm.body.accessToken;

    const loginStaff = await api
      .post('/api/v1/auth/login')
      .send({ email: 'staff@example.com', password: 'Password123!' });
    staffToken = loginStaff.body.accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('Verifies AC1-AC8: expense numbering, tax calc, project linking, PM & SITE_STAFF RBAC, pay/void flows, gross profit on Project Summary, and CSV/Excel exports', async () => {
    const api = testRequest(app);

    // 1. Setup Client (ACM) + Quotation + Project P26-001 (RM 100,000 contract)
    const clientRes = await api
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ code: 'ACM', name: 'Acme Corp Sdn Bhd' });
    clientId = clientRes.body.id;

    const qRes = await api
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        clientId,
        title: 'Renovation Contract',
        issueDate: '2026-11-01',
        discountAmount: '0.00',
        sections: [
          {
            title: 'Main Works',
            items: [
              {
                description: 'Renovation works',
                unit: 'LS',
                quantity: '1.000',
                rate: '100000.00',
                taxRateId: null,
              },
            ],
          },
        ],
      });
    await api
      .post(`/api/v1/quotations/${qRes.body.id}/send`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const accRes = await api
      .post(`/api/v1/quotations/${qRes.body.id}/accept`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ createProject: true, projectName: 'Acme Renovation' });
    project1Id = accRes.body.projectId;

    // Assign PM to Project 1 only
    await api
      .put(`/api/v1/projects/${project1Id}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userIds: [pmUserId] });

    // Create Project 2 (PM is not a member)
    const p2Res = await api
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        code: 'P26-002',
        name: 'Other Project',
        clientId,
        status: 'ACTIVE',
      });
    project2Id = p2Res.body.id;

    // Issue Progress Claim #1 on Project 1 for 50% = RM 50,000.00 claimedToDate
    const contractRes = await api
      .get(`/api/v1/projects/${project1Id}/contract`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const pc1 = await api
      .post(`/api/v1/projects/${project1Id}/progress-claims`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    await api
      .put(`/api/v1/invoices/${pc1.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        issueDate: '2026-11-10',
        claimLines: contractRes.body.items.map((ci: any) => ({
          contractItemId: ci.id,
          cumulativePercent: '50.00',
        })),
      });
    await api
      .post(`/api/v1/invoices/${pc1.body.id}/issue`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    // =========================================================================
    // AC1, AC2, AC3: Create Expense #1 (Materials on Project 1 with 6% SST)
    // =========================================================================
    const exp1Res = await api
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        projectId: project1Id,
        category: 'MATERIALS',
        status: 'PAID',
        expenseDate: '2026-11-12',
        vendorName: 'Sin Heng Hardware Sdn Bhd',
        billReference: 'SH-8821',
        description: '50 bags Portland cement & steel mesh',
        amount: '10000.00',
        taxRateId,
        paymentMethod: 'BANK_TRANSFER',
        paymentReference: 'FPX-1001',
      });
    expect(exp1Res.status).toBe(201);
    expect(exp1Res.body.number).toBe('EXP-26-0001'); // AC1
    expect(exp1Res.body.projectCodeRef).toBe('P26-001'); // AC3
    expect(exp1Res.body.subtotal).toBe('10000.00'); // AC2
    expect(exp1Res.body.taxPercent).toBe('6.00');
    expect(exp1Res.body.taxAmount).toBe('600.00');
    expect(exp1Res.body.total).toBe('10600.00');

    // =========================================================================
    // AC1, AC6: Create Expense #2 (UNPAID Subcontractor bill on Project 1, then pay it)
    // =========================================================================
    const exp2Res = await api
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        projectId: project1Id,
        category: 'SUBCONTRACTOR',
        status: 'UNPAID',
        expenseDate: '2026-11-14',
        vendorName: 'Ali Electrical Enterprise',
        billReference: 'AE-009',
        description: 'First fix conduit & wiring',
        amount: '4400.00',
      });
    expect(exp2Res.status).toBe(201);
    expect(exp2Res.body.number).toBe('EXP-26-0002');
    expect(exp2Res.body.status).toBe('UNPAID');
    expect(exp2Res.body.total).toBe('4400.00');

    const payExp2 = await api
      .post(`/api/v1/expenses/${exp2Res.body.id}/pay`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        status: 'PAID',
        paidDate: '2026-11-18',
        paymentMethod: 'CHEQUE',
        paymentReference: 'MBB-112233',
      });
    expect(payExp2.status).toBe(200);
    expect(payExp2.body.status).toBe('PAID');
    expect(payExp2.body.paidDate).toBe('2026-11-18');

    // =========================================================================
    // AC6: Create Expense #3 and VOID it (must be excluded from totals)
    // =========================================================================
    const exp3Res = await api
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        projectId: project1Id,
        category: 'TOOLS_EQUIPMENT',
        status: 'UNPAID',
        expenseDate: '2026-11-15',
        vendorName: 'Duplicate Vendor',
        description: 'Entered twice by mistake',
        amount: '9999.00',
      });
    expect(exp3Res.status).toBe(201);
    expect(exp3Res.body.number).toBe('EXP-26-0003');

    const voidExp3 = await api
      .post(`/api/v1/expenses/${exp3Res.body.id}/void`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'Duplicate entry' });
    expect(voidExp3.status).toBe(200);
    expect(voidExp3.body.status).toBe('VOID');

    // =========================================================================
    // AC4 & AC5: RBAC enforcement for PROJECT_MANAGER and SITE_STAFF
    // =========================================================================
    const pmWrongProj = await api
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        projectId: project2Id,
        category: 'MATERIALS',
        expenseDate: '2026-11-15',
        vendorName: 'Shop',
        description: 'Unauthorized project',
        amount: '100.00',
      });
    expect(pmWrongProj.status).toBe(403);

    const staffForbidden = await api
      .get('/api/v1/expenses')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(staffForbidden.status).toBe(403);

    // =========================================================================
    // AC7: Project Summary & Dashboard include totalExpenses & grossProfit
    // =========================================================================
    // Non-void expenses on Project 1 = 10,600.00 + 4,400.00 = 15,000.00
    // Claimed to date = 50,000.00 -> Gross Profit = 50,000.00 - 15,000.00 = 35,000.00
    const projSummaryRes = await api
      .get(`/api/v1/reports/projects/${project1Id}/summary`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(projSummaryRes.status).toBe(200);
    expect(projSummaryRes.body.claimedToDate).toBe('50000.00');
    expect(projSummaryRes.body.totalExpenses).toBe('15000.00');
    expect(projSummaryRes.body.grossProfit).toBe('35000.00');

    const dashRes = await api
      .get('/api/v1/reports/dashboard?asOf=2026-11-19')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.expensesThisMonth).toBe('15000.00');

    // =========================================================================
    // AC8: CSV and Excel (.xlsx) exports for expenses
    // =========================================================================
    const csvRes = await api
      .get('/api/v1/exports/expenses.csv?from=2026-11-01&to=2026-11-30')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.text).toContain('EXP-26-0001');
    expect(csvRes.text).toContain('EXP-26-0002');
    expect(csvRes.text).not.toContain('EXP-26-0003'); // VOID excluded

    const xlsxRes = await api
      .get('/api/v1/reports/expenses?format=xlsx')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(xlsxRes.status).toBe(200);
    expect(xlsxRes.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(Buffer.isBuffer(xlsxRes.body)).toBe(true);
    expect(xlsxRes.body.slice(0, 2).toString('utf8')).toBe('PK');
  });
});
