import { describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { SequenceService } from '../src/company/sequence.service';

describe('SequenceService concurrency (Spec 01 AC7)', () => {
  it('never issues duplicate numbers under concurrent requests', async () => {
    process.env.USE_IN_MEMORY_DB = 'true';
    const prisma = new PrismaService();
    const seq = new SequenceService(prisma);

    const results = await Promise.all(
      Array.from({ length: 25 }, () => seq.next('QT', undefined, 2026)),
    );

    const unique = new Set(results);
    expect(unique.size).toBe(25);
    expect(results).toContain('QT-2026-0001');
    expect(results).toContain('QT-2026-0025');
  });
});
