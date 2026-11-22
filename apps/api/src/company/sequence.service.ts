import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SequenceService {
  private memLocks = new Map<string, Promise<void>>();

  constructor(private readonly prisma: PrismaService) {}

  private async withMemLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.memLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.memLocks.set(key, prev.then(() => next));
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async next(docType: string, tx?: any, yearOverride?: number): Promise<string> {
    const year = yearOverride ?? new Date().getUTCFullYear();
    const client = tx || this.prisma;

    if (this.prisma.isInMemory || typeof client.$queryRaw !== 'function') {
      return this.withMemLock(`${docType}:${year}`, async () => {
        const existing = await client.documentSequence.findUnique({
          where: { docType_year: { docType, year } },
        });
        let nextNo: number;
        if (!existing) {
          nextNo = 1;
          await client.documentSequence.create({
            data: { id: uuidv7(), docType, year, lastNumber: nextNo },
          });
        } else {
          nextNo = existing.lastNumber + 1;
          await client.documentSequence.update({
            where: { id: existing.id },
            data: { lastNumber: nextNo },
          });
        }
        return `${docType}-${year}-${String(nextNo).padStart(4, '0')}`;
      });
    }

    const runner = async (dbTx: any) => {
      const id = uuidv7();
      await dbTx.$executeRaw`
        INSERT INTO "DocumentSequence" ("id", "docType", "year", "lastNumber", "updatedAt")
        VALUES (${id}::uuid, ${docType}, ${year}, 0, NOW())
        ON CONFLICT ("docType", "year") DO NOTHING
      `;
      const rows: Array<{ id: string; lastNumber: number }> = await dbTx.$queryRaw`
        SELECT "id", "lastNumber"
        FROM "DocumentSequence"
        WHERE "docType" = ${docType} AND "year" = ${year}
        FOR UPDATE
      `;
      const nextNo = (rows[0]?.lastNumber ?? 0) + 1;
      await dbTx.$executeRaw`
        UPDATE "DocumentSequence"
        SET "lastNumber" = ${nextNo}, "updatedAt" = NOW()
        WHERE "docType" = ${docType} AND "year" = ${year}
      `;
      return `${docType}-${year}-${String(nextNo).padStart(4, '0')}`;
    };

    if (tx) {
      return runner(tx);
    }
    return this.prisma.$transaction(runner);
  }
}
