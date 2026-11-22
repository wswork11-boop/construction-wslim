import { Injectable } from '@nestjs/common';
import {
  CompanyUpdate,
  formatPercent,
  PaginationQuery,
  TaxRateCreate,
  TaxRateUpdate,
} from '@construction/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { AuthUser } from '../common/decorators';
import { AppException } from '../common/errors';
import { parseSort } from '../common/pagination';

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  serializeCompany(company: any) {
    return {
      id: company.id,
      name: company.name,
      registrationNo: company.registrationNo ?? null,
      tin: company.tin ?? null,
      sstNo: company.sstNo ?? null,
      msicCode: company.msicCode ?? null,
      address: company.address ?? null,
      phone: company.phone ?? null,
      email: company.email ?? null,
      logoFileId: company.logoFileId ?? null,
      bankDetails: company.bankDetails ?? null,
      defaultPaymentTermDays: company.defaultPaymentTermDays,
      defaultRetentionPercent: formatPercent(company.defaultRetentionPercent),
      defaultRetentionCapPercent: formatPercent(company.defaultRetentionCapPercent),
      createdAt:
        company.createdAt instanceof Date ? company.createdAt.toISOString() : company.createdAt,
      updatedAt:
        company.updatedAt instanceof Date ? company.updatedAt.toISOString() : company.updatedAt,
    };
  }

  serializeTaxRate(tr: any) {
    return {
      id: tr.id,
      name: tr.name,
      percent: formatPercent(tr.percent),
      isDefault: tr.isDefault,
      isActive: tr.isActive,
      createdAt: tr.createdAt instanceof Date ? tr.createdAt.toISOString() : tr.createdAt,
      updatedAt: tr.updatedAt instanceof Date ? tr.updatedAt.toISOString() : tr.updatedAt,
    };
  }

  async getCompany() {
    let company = await this.prisma.company.findUnique({ where: { singleton: true } });
    if (!company) {
      company = await this.prisma.company.create({
        data: {
          singleton: true,
          name: 'Contoh Bina Sdn Bhd',
          defaultPaymentTermDays: 30,
          defaultRetentionPercent: 10,
          defaultRetentionCapPercent: 5,
        },
      });
    }
    return this.serializeCompany(company);
  }

  async updateCompany(user: AuthUser, dto: CompanyUpdate) {
    const existing = await this.getCompany();

    if (dto.logoFileId) {
      const file = await this.prisma.file.findUnique({ where: { id: dto.logoFileId } });
      if (!file) {
        throw AppException.unprocessable(
          'FILE_NOT_UPLOADED',
          'logoFileId does not reference an uploaded file',
        );
      }
      if (file.status === 'PENDING') {
        await this.prisma.file.update({
          where: { id: file.id },
          data: { status: 'READY' },
        });
      }
    }

    const updated = await this.prisma.company.update({
      where: { singleton: true },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.registrationNo !== undefined ? { registrationNo: dto.registrationNo } : {}),
        ...(dto.tin !== undefined ? { tin: dto.tin } : {}),
        ...(dto.sstNo !== undefined ? { sstNo: dto.sstNo } : {}),
        ...(dto.msicCode !== undefined ? { msicCode: dto.msicCode } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.logoFileId !== undefined ? { logoFileId: dto.logoFileId } : {}),
        ...(dto.bankDetails !== undefined ? { bankDetails: dto.bankDetails } : {}),
        ...(dto.defaultPaymentTermDays !== undefined
          ? { defaultPaymentTermDays: dto.defaultPaymentTermDays }
          : {}),
        ...(dto.defaultRetentionPercent !== undefined
          ? { defaultRetentionPercent: dto.defaultRetentionPercent }
          : {}),
        ...(dto.defaultRetentionCapPercent !== undefined
          ? { defaultRetentionCapPercent: dto.defaultRetentionCapPercent }
          : {}),
      },
    });

    const serialized = this.serializeCompany(updated);
    await this.auditService.log({
      userId: user.id,
      entity: 'Company',
      entityId: updated.id,
      action: 'UPDATE',
      before: existing,
      after: serialized,
    });
    return serialized;
  }

  async listTaxRates(query: PaginationQuery & { isActive?: boolean }) {
    const where: any = {};
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.q) {
      where.name = { contains: query.q };
    }
    const orderBy = parseSort(query.sort, ['createdAt', 'name', 'percent']);
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      this.prisma.taxRate.findMany({ where, orderBy, skip, take: query.pageSize }),
      this.prisma.taxRate.count({ where }),
    ]);

    return {
      items: items.map((tr) => this.serializeTaxRate(tr)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async createTaxRate(user: AuthUser, dto: TaxRateCreate) {
    return this.prisma.$transaction(async (tx: any) => {
      if (dto.isDefault) {
        await tx.taxRate.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }
      const created = await tx.taxRate.create({
        data: {
          name: dto.name.trim(),
          percent: dto.percent,
          isDefault: dto.isDefault ?? false,
          isActive: dto.isActive ?? true,
        },
      });
      const serialized = this.serializeTaxRate(created);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'TaxRate',
          entityId: created.id,
          action: 'CREATE',
          after: serialized,
        },
        tx,
      );
      return serialized;
    });
  }

  async updateTaxRate(user: AuthUser, id: string, dto: TaxRateUpdate) {
    const existing = await this.prisma.taxRate.findUnique({ where: { id } });
    if (!existing) {
      throw AppException.notFound('NOT_FOUND', 'Tax rate not found');
    }

    return this.prisma.$transaction(async (tx: any) => {
      if (dto.isDefault) {
        await tx.taxRate.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }
      const updated = await tx.taxRate.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.percent !== undefined ? { percent: dto.percent } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      const serialized = this.serializeTaxRate(updated);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'TaxRate',
          entityId: id,
          action: 'UPDATE',
          before: this.serializeTaxRate(existing),
          after: serialized,
        },
        tx,
      );
      return serialized;
    });
  }
}
