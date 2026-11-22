import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { testRequest } from './http-test-client';
import { AppModule, configureApp } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedDatabase } from '../prisma/seed';

describe('Spec 01 - Foundation e2e (AC1 - AC8)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let officeToken: string;
  let siteStaffToken: string;
  let siteStaffId: string;
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
  });

  afterAll(async () => {
    await app?.close();
  });

  it('AC1: wrong password returns 401 INVALID_CREDENTIALS and 5 failures in 15m locks with 429 LOGIN_LOCKED', async () => {
    const targetEmail = 'lockout-test@example.com';

    for (let i = 0; i < 5; i++) {
      const res = await testRequest(app)
        .post('/api/v1/auth/login')
        .send({ email: targetEmail, password: 'WrongPassword1!' });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    }

    const lockedRes = await testRequest(app)
      .post('/api/v1/auth/login')
      .send({ email: targetEmail, password: 'WrongPassword1!' });
    expect(lockedRes.status).toBe(429);
    expect(lockedRes.body.code).toBe('LOGIN_LOCKED');
  });

  it('AC2: login returns accessToken (expiresIn 900) and refreshToken; refresh rotates token and invalidates old token', async () => {
    const loginRes = await testRequest(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'owner@example.com',
        password: 'Password123!',
        deviceName: 'Owner Laptop',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.expiresIn).toBe(900);
    expect(loginRes.body.accessToken).toBeDefined();
    expect(loginRes.body.refreshToken).toBeDefined();

    const oldRefresh = loginRes.body.refreshToken;
    const refreshRes = await testRequest(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefresh });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();
    expect(refreshRes.body.refreshToken).toBeDefined();
    expect(refreshRes.body.refreshToken).not.toBe(oldRefresh);
    ownerToken = refreshRes.body.accessToken;

    // Reusing the old refresh token fails with 401
    const reuseRes = await testRequest(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefresh });
    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('AC3: a deactivated user cannot log in and existing refresh tokens stop working', async () => {
    const createRes = await testRequest(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: 'tempstaff@example.com',
        name: 'Temp Staff',
        role: 'SITE_STAFF',
        password: 'Password123!',
      });
    expect(createRes.status).toBe(201);
    const tempUserId = createRes.body.id;

    const loginRes = await testRequest(app)
      .post('/api/v1/auth/login')
      .send({ email: 'tempstaff@example.com', password: 'Password123!' });
    expect(loginRes.status).toBe(200);
    const tempRefresh = loginRes.body.refreshToken;
    const tempAccess = loginRes.body.accessToken;

    // Deactivate user
    const deactRes = await testRequest(app)
      .patch(`/api/v1/users/${tempUserId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ isActive: false });
    expect(deactRes.status).toBe(200);
    expect(deactRes.body.isActive).toBe(false);

    // Login fails
    const loginAgain = await testRequest(app)
      .post('/api/v1/auth/login')
      .send({ email: 'tempstaff@example.com', password: 'Password123!' });
    expect(loginAgain.status).toBe(401);

    // Existing refresh token fails
    const refreshAgain = await testRequest(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: tempRefresh });
    expect(refreshAgain.status).toBe(401);

    // Existing access token fails
    const meAgain = await testRequest(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tempAccess}`);
    expect(meAgain.status).toBe(401);
  });

  it('AC6 & AC8: creates OFFICE and SITE_STAFF users, clients, projects, checks 409 uniqueness and writes AuditLog', async () => {
    const officeRes = await testRequest(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: 'meiling@example.com',
        name: 'Mei Ling',
        role: 'OFFICE',
        password: 'Password123!',
      });
    expect(officeRes.status).toBe(201);

    const staffRes = await testRequest(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: 'kumar@example.com',
        name: 'Kumar',
        role: 'SITE_STAFF',
        password: 'Password123!',
      });
    expect(staffRes.status).toBe(201);
    siteStaffId = staffRes.body.id;

    const officeLogin = await testRequest(app)
      .post('/api/v1/auth/login')
      .send({ email: 'meiling@example.com', password: 'Password123!' });
    officeToken = officeLogin.body.accessToken;

    const staffLogin = await testRequest(app)
      .post('/api/v1/auth/login')
      .send({ email: 'kumar@example.com', password: 'Password123!' });
    siteStaffToken = staffLogin.body.accessToken;

    // Create client
    const clientRes = await testRequest(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({
        name: 'Syarikat ABC Sdn Bhd',
        registrationNo: '202001012345',
        tin: 'C1234567890',
        email: 'info@abc.example.com',
      });
    expect(clientRes.status).toBe(201);
    clientId = clientRes.body.id;

    // AC6: duplicate client email returns 409 CLIENT_EMAIL_TAKEN
    const dupClientRes = await testRequest(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({
        name: 'Another ABC',
        email: 'info@abc.example.com',
      });
    expect(dupClientRes.status).toBe(409);
    expect(dupClientRes.body.code).toBe('CLIENT_EMAIL_TAKEN');

    // Create two projects
    const p1Res = await testRequest(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({
        code: 'P-2026-003',
        name: 'Shoplot renovation, Jalan Bunga',
        clientId,
        status: 'ACTIVE',
      });
    expect(p1Res.status).toBe(201);
    project1Id = p1Res.body.id;

    const p2Res = await testRequest(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({
        code: 'P-2026-005',
        name: 'Taman Indah bungalow',
        clientId,
        status: 'ACTIVE',
      });
    expect(p2Res.status).toBe(201);
    project2Id = p2Res.body.id;

    // AC6: duplicate project code returns 409 PROJECT_CODE_TAKEN
    const dupProjRes = await testRequest(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({
        code: 'P-2026-003',
        name: 'Duplicate Code Project',
        clientId,
      });
    expect(dupProjRes.status).toBe(409);
    expect(dupProjRes.body.code).toBe('PROJECT_CODE_TAKEN');

    // Assign Kumar (SITE_STAFF) ONLY to project 1
    const memRes = await testRequest(app)
      .put(`/api/v1/projects/${project1Id}/members`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ userIds: [siteStaffId] });
    expect(memRes.status).toBe(200);
    expect(memRes.body.total).toBe(1);

    // AC8: Verify AuditLog entries were written for User, Client, Project
    const logs = await prisma.auditLog.findMany();
    const entities = new Set(logs.map((l: any) => l.entity));
    expect(entities.has('User')).toBe(true);
    expect(entities.has('Client')).toBe(true);
    expect(entities.has('Project')).toBe(true);
  });

  it('AC4: SITE_STAFF calling GET /projects receives only member projects, with contractSum absent', async () => {
    const listRes = await testRequest(app)
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${siteStaffToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.total).toBe(1);
    expect(listRes.body.items[0].id).toBe(project1Id);
    expect('contractSum' in listRes.body.items[0]).toBe(false);

    // Accessing member project detail omits contractSum
    const detailRes = await testRequest(app)
      .get(`/api/v1/projects/${project1Id}`)
      .set('Authorization', `Bearer ${siteStaffToken}`);
    expect(detailRes.status).toBe(200);
    expect('contractSum' in detailRes.body).toBe(false);

    // Accessing non-member project returns 403 NOT_PROJECT_MEMBER
    const nonMemberRes = await testRequest(app)
      .get(`/api/v1/projects/${project2Id}`)
      .set('Authorization', `Bearer ${siteStaffToken}`);
    expect(nonMemberRes.status).toBe(403);
    expect(nonMemberRes.body.code).toBe('NOT_PROJECT_MEMBER');
  });

  it('AC5: SITE_STAFF calling any /quotations, /invoices, /payments route receives 403', async () => {
    const qRes = await testRequest(app)
      .get('/api/v1/quotations')
      .set('Authorization', `Bearer ${siteStaffToken}`);
    expect(qRes.status).toBe(403);

    const invRes = await testRequest(app)
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${siteStaffToken}`);
    expect(invRes.status).toBe(403);

    const payRes = await testRequest(app)
      .get('/api/v1/payments')
      .set('Authorization', `Bearer ${siteStaffToken}`);
    expect(payRes.status).toBe(403);
  });
});
