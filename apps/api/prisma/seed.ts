import { PrismaClient, Role } from '@prisma/client';
import { argon2id } from 'hash-wasm';
import * as crypto from 'crypto';

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return argon2id({
    password,
    salt,
    parallelism: 1,
    iterations: 2,
    memorySize: 19456,
    hashLength: 32,
    outputType: 'encoded',
  });
}

export async function seedDatabase(prisma: PrismaClient) {
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

if (require.main === module) {
  const prisma = new PrismaClient();
  seedDatabase(prisma)
    .then(async () => {
      await prisma.$disconnect();
      console.log('Database seeded in PostgreSQL.');
    })
    .catch(async (err: any) => {
      await prisma.$disconnect().catch(() => {});
      if (err?.code === 'P1000' || err?.code === 'P1001' || String(err?.message || '').includes('Authentication failed')) {
        console.warn(
          '[seed] PostgreSQL at localhost is not reachable or uses different credentials. Skipping external DB seed — `pnpm dev` will automatically use and seed the built-in database.',
        );
        process.exit(0);
      }
      console.error(err);
      process.exit(1);
    });
}
