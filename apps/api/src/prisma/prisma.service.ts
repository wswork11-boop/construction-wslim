import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Role } from '@prisma/client';
import * as path from 'path';
import { InMemoryDatabase } from './in-memory-db';
import { hashPassword } from '../common/password';

export async function seedInitialData(prisma: any) {
  const ownerEmail = (process.env.SEED_OWNER_EMAIL || 'owner@example.com').toLowerCase().trim();
  const ownerPassword = process.env.SEED_OWNER_PASSWORD || 'Password123!';
  const ownerName = process.env.SEED_OWNER_NAME || 'Owner';

  const passwordHash = await hashPassword(ownerPassword);

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {
      name: ownerName,
      role: Role.OWNER,
      isActive: true,
    },
    create: {
      email: ownerEmail,
      passwordHash,
      name: ownerName,
      role: Role.OWNER,
      isActive: true,
    },
  });

  const company = await prisma.company.upsert({
    where: { singleton: true },
    update: {},
    create: {
      singleton: true,
      name: 'Contoh Bina Sdn Bhd',
      registrationNo: '201901000001',
      tin: 'C0000000001',
      address: '1 Jalan Contoh, 47000 Sungai Buloh, Selangor',
      phone: '03-0000 0000',
      email: 'office@example.com',
      defaultPaymentTermDays: 30,
      defaultRetentionPercent: 10,
      defaultRetentionCapPercent: 5,
    },
  });

  await prisma.taxRate.upsert({
    where: { name: 'SST 6%' },
    update: {},
    create: {
      name: 'SST 6%',
      percent: 6,
      isDefault: true,
      isActive: true,
    },
  });

  await prisma.taxRate.upsert({
    where: { name: 'No tax' },
    update: {},
    create: {
      name: 'No tax',
      percent: 0,
      isDefault: false,
      isActive: true,
    },
  });

  return { owner, company };
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  public inMemoryDb?: InMemoryDatabase;
  public isInMemory: boolean;

  constructor() {
    super();
    this.isInMemory = process.env.USE_IN_MEMORY_DB === 'true';
    if (this.isInMemory) {
      this.enableInMemoryMode();
    }
  }

  private enableInMemoryMode() {
    this.isInMemory = true;
    const isTest = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
    const persistPath = isTest
      ? undefined
      : path.resolve(process.cwd(), '.data', 'local-db.json');
    this.inMemoryDb = new InMemoryDatabase(persistPath);
    const memClient = this.inMemoryDb.getClient();
    this.inMemoryDb.loadFromDisk();
    Object.assign(this, memClient);
  }

  async onModuleInit() {
    if (!this.isInMemory) {
      try {
        await this.$connect();
        if (!process.env.VITEST) {
          await seedInitialData(this).catch((seedErr) => {
            console.warn('[PrismaService] Auto-seed skipped (run `prisma db push` if tables are not created yet):', seedErr?.message?.split('\n')[0] || seedErr);
          });
        }
        return;
      } catch (err: any) {
        console.warn(
          `[PrismaService] PostgreSQL connection failed (${err?.message?.split('\n')[0] || err}). Falling back to persistent local database (.data/local-db.json).`,
        );
        this.enableInMemoryMode();
      }
    }

    if (this.isInMemory && !process.env.VITEST) {
      await seedInitialData(this);
      console.log('Persistent local database ready at .data/local-db.json (owner@example.com / Password123!)');
    }
  }

  async onModuleDestroy() {
    if (!this.isInMemory) {
      await this.$disconnect();
    }
  }
}
