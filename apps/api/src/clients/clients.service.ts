import { Injectable } from '@nestjs/common';
import { ClientCreate, ClientUpdate, deriveClientCode, PaginationQuery } from '@construction/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { AuthUser } from '../common/decorators';
import { AppException } from '../common/errors';
import { parseSort } from '../common/pagination';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  serializeClient(client: any) {
    return {
      id: client.id,
      code: deriveClientCode(client.name, client.code),
      name: client.name,
      registrationNo: client.registrationNo ?? null,
      tin: client.tin ?? null,
      sstNo: client.sstNo ?? null,
      address: client.address ?? null,
      contactName: client.contactName ?? null,
      phone: client.phone ?? null,
      email: client.email ?? null,
      isActive: client.isActive,
      createdAt:
        client.createdAt instanceof Date ? client.createdAt.toISOString() : client.createdAt,
      updatedAt:
        client.updatedAt instanceof Date ? client.updatedAt.toISOString() : client.updatedAt,
    };
  }

  async list(query: PaginationQuery & { isActive?: boolean }) {
    const where: any = {};
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.q) {
      where.OR = [
        { name: { contains: query.q } },
        { email: { contains: query.q } },
        { contactName: { contains: query.q } },
      ];
    }

    const orderBy = parseSort(query.sort, ['createdAt', 'name']);
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      this.prisma.client.findMany({ where, orderBy, skip, take: query.pageSize }),
      this.prisma.client.count({ where }),
    ]);

    return {
      items: items.map((c) => this.serializeClient(c)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getById(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw AppException.notFound('NOT_FOUND', 'Client not found');
    }
    return this.serializeClient(client);
  }

  async create(user: AuthUser, dto: ClientCreate) {
    const email = dto.email ? dto.email.toLowerCase().trim() : null;
    if (email) {
      const existing = await this.prisma.client.findUnique({ where: { email } });
      if (existing) {
        throw AppException.conflict('CLIENT_EMAIL_TAKEN', 'Another client already has this email');
      }
    }

    const code = deriveClientCode(dto.name, dto.code);

    return this.prisma.$transaction(async (tx: any) => {
      const created = await tx.client.create({
        data: {
          code,
          name: dto.name.trim(),
          registrationNo: dto.registrationNo ?? null,
          tin: dto.tin ?? null,
          sstNo: dto.sstNo ?? null,
          address: dto.address ?? null,
          contactName: dto.contactName ?? null,
          phone: dto.phone ?? null,
          email,
          isActive: true,
        },
      });
      const serialized = this.serializeClient(created);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Client',
          entityId: created.id,
          action: 'CREATE',
          after: serialized,
        },
        tx,
      );
      return serialized;
    });
  }

  async update(user: AuthUser, id: string, dto: ClientUpdate) {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing) {
      throw AppException.notFound('NOT_FOUND', 'Client not found');
    }

    let email: string | null | undefined = undefined;
    if (dto.email !== undefined) {
      email = dto.email ? dto.email.toLowerCase().trim() : null;
      if (email && email !== existing.email) {
        const conflict = await this.prisma.client.findUnique({ where: { email } });
        if (conflict) {
          throw AppException.conflict(
            'CLIENT_EMAIL_TAKEN',
            'Another client already has this email',
          );
        }
      }
    }

    const code =
      dto.code !== undefined
        ? deriveClientCode(dto.name ?? existing.name, dto.code)
        : undefined;

    return this.prisma.$transaction(async (tx: any) => {
      const updated = await tx.client.update({
        where: { id },
        data: {
          ...(code !== undefined ? { code } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.registrationNo !== undefined ? { registrationNo: dto.registrationNo } : {}),
          ...(dto.tin !== undefined ? { tin: dto.tin } : {}),
          ...(dto.sstNo !== undefined ? { sstNo: dto.sstNo } : {}),
          ...(dto.address !== undefined ? { address: dto.address } : {}),
          ...(dto.contactName !== undefined ? { contactName: dto.contactName } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(email !== undefined ? { email } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });

      const serialized = this.serializeClient(updated);
      const action =
        dto.isActive === false && existing.isActive ? 'DEACTIVATE' : 'UPDATE';

      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Client',
          entityId: id,
          action,
          before: this.serializeClient(existing),
          after: serialized,
        },
        tx,
      );
      return serialized;
    });
  }
}
