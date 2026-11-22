import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogInput {
  userId?: string | null;
  entity: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
}

function sanitizeJson(val: unknown): any {
  if (val === undefined || val === null) return null;
  return JSON.parse(
    JSON.stringify(val, (key, value) => {
      if (key === 'passwordHash' || key === 'password') return undefined;
      return value;
    }),
  );
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput, tx?: any) {
    const client = tx || this.prisma;
    return client.auditLog.create({
      data: {
        userId: input.userId ?? null,
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        before: sanitizeJson(input.before),
        after: sanitizeJson(input.after),
      },
    });
  }
}
