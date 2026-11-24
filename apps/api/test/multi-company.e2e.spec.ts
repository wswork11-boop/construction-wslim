import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule, configureApp } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedDatabase } from '../prisma/seed';
import { testRequest } from './http-test-client';

describe('Spec 08 - Multi-Company Profiles & Direct User-to-Project Assignment E2E (AC1 - AC5)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;

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
    const loginRes = await api
      .post('/api/v1/auth/login')
      .send({ email: 'owner@example.com', password: 'Password123!' });
    ownerToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('Verifies AC1-AC5: creating multiple companies, linking a project to Company B, billing under Company B, and assigning a user from an external company to specific projects', async () => {
    const api = testRequest(app);

    // 1. AC1: Create a second sister company (Company B)
    const compBRes = await api
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        code: 'CME',
        name: 'Contoh Maju Engineering Sdn Bhd',
        registrationNo: '202401099887',
        tin: 'C9988776655',
        address: '88 Jalan Industri, Shah Alam',
        bankDetails: 'Maybank 5140-1122-3344',
      });
    expect(compBRes.status).toBe(201);
    expect(compBRes.body.code).toBe('CME');
    expect(compBRes.body.name).toBe('Contoh Maju Engineering Sdn Bhd');
    const companyBId = compBRes.body.id;

    const listCompRes = await api
      .get('/api/v1/companies')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(listCompRes.status).toBe(200);
    expect(listCompRes.body.items.length).toBeGreaterThanOrEqual(2);

    // 2. Create Client + 2 Projects (Project 1 under Company B, Project 2 under primary company)
    const clientRes = await api
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ code: 'ACM', name: 'Acme Corp Sdn Bhd' });
    const clientId = clientRes.body.id;

    const p1Res = await api
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        code: 'P26-101',
        name: 'Shah Alam Factory Fit-Out',
        clientId,
        companyId: companyBId,
        status: 'ACTIVE',
      });
    expect(p1Res.status).toBe(201);
    expect(p1Res.body.companyId).toBe(companyBId);
    expect(p1Res.body.company.name).toBe('Contoh Maju Engineering Sdn Bhd');
    const project1Id = p1Res.body.id;

    const p2Res = await api
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        code: 'P26-102',
        name: 'KL Office Renovation',
        clientId,
        status: 'ACTIVE',
      });
    expect(p2Res.status).toBe(201);
    const project2Id = p2Res.body.id;

    // 3. AC2: Issue an invoice on Project 1 and verify supplier snapshot uses Company B
    const invRes = await api
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'SIMPLE',
        clientId,
        projectId: project1Id,
        lines: [{ description: 'M&E mobilization', quantity: '1.000', rate: '12000.00' }],
      });
    expect(invRes.status).toBe(201);

    const issueRes = await api
      .post(`/api/v1/invoices/${invRes.body.id}/issue`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(issueRes.status).toBe(200);
    expect(issueRes.body.supplierName).toBe('Contoh Maju Engineering Sdn Bhd');
    expect(issueRes.body.supplierRegistrationNo).toBe('202401099887');
    expect(issueRes.body.supplierTin).toBe('C9988776655');

    // 4. AC3 & AC4: Create a user from an external company and assign them directly to Project 1
    const subconUserRes = await api
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Encik Razak',
        email: 'razak@subcon.com.my',
        password: 'Password123!',
        role: 'PROJECT_MANAGER',
        companyName: 'Razak M&E Subcontractor Sdn Bhd',
        projectIds: [project1Id],
      });
    expect(subconUserRes.status).toBe(201);
    expect(subconUserRes.body.companyName).toBe('Razak M&E Subcontractor Sdn Bhd');
    expect(subconUserRes.body.projects).toEqual([
      {
        id: project1Id,
        code: 'P26-101',
        name: 'Shah Alam Factory Fit-Out',
      },
    ]);

    // 5. AC5: Log in as Encik Razak and verify he only sees his assigned project (P26-101)
    const loginRazak = await api
      .post('/api/v1/auth/login')
      .send({ email: 'razak@subcon.com.my', password: 'Password123!' });
    expect(loginRazak.status).toBe(200);
    const razakToken = loginRazak.body.accessToken;

    const razakProjectsRes = await api
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${razakToken}`);
    expect(razakProjectsRes.status).toBe(200);
    expect(razakProjectsRes.body.items).toHaveLength(1);
    expect(razakProjectsRes.body.items[0].id).toBe(project1Id);

    // 6. Owner reassigns Encik Razak to both Project 1 and Project 2 via PATCH /api/v1/users/:id
    const updateRazak = await api
      .patch(`/api/v1/users/${subconUserRes.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        projectIds: [project1Id, project2Id],
      });
    expect(updateRazak.status).toBe(200);
    expect(updateRazak.body.projects).toHaveLength(2);
  });
});
