import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import {
  deriveClientCode,
  formatMoney,
  formatPercent,
  formatQuantity,
  formatVariationOrderNumbers,
  PaginationQuery,
  roundMoney,
  sumMoney,
  toDecimal,
  VariationOrderInput,
  VariationStatus,
} from '@construction/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { AuthUser } from '../common/decorators';
import { AppException } from '../common/errors';
import { ProjectAccessService } from '../common/project-access.service';

@Injectable()
export class VariationOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccessService: ProjectAccessService,
    private readonly auditService: AuditService,
  ) {}

  serializeSummary(vo: any) {
    return {
      id: vo.id,
      number: vo.number,
      shortRef: vo.shortRef ?? null,
      projectId: vo.projectId,
      title: vo.title,
      reason: vo.reason ?? null,
      status: vo.status,
      approvedAt:
        vo.approvedAt instanceof Date ? vo.approvedAt.toISOString() : vo.approvedAt ?? null,
      total: formatMoney(vo.total),
      createdById: vo.createdById,
      createdAt: vo.createdAt instanceof Date ? vo.createdAt.toISOString() : vo.createdAt,
      updatedAt: vo.updatedAt instanceof Date ? vo.updatedAt.toISOString() : vo.updatedAt,
    };
  }

  serializeFull(vo: any) {
    return {
      ...this.serializeSummary(vo),
      items: (vo.items || []).map((i: any) => ({
        id: i.id,
        variationOrderId: i.variationOrderId,
        sortOrder: i.sortOrder,
        description: i.description,
        unit: i.unit ?? null,
        quantity: formatQuantity(i.quantity),
        rate: formatMoney(i.rate),
        amount: formatMoney(i.amount),
      })),
    };
  }

  async listByProject(
    user: AuthUser,
    projectId: string,
    query: PaginationQuery & { status?: VariationStatus },
  ) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw AppException.notFound('NOT_FOUND', 'Project not found');
    }
    await this.projectAccessService.assertMember(user, projectId);

    const all = await this.prisma.variationOrder.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    const filtered = all.filter((vo: any) => {
      if (query.status && vo.status !== query.status) return false;
      if (query.q) {
        const needle = query.q.toLowerCase();
        if (
          !String(vo.number).toLowerCase().includes(needle) &&
          !String(vo.title).toLowerCase().includes(needle)
        ) {
          return false;
        }
      }
      return true;
    });

    const skip = (query.page - 1) * query.pageSize;
    const paged = filtered.slice(skip, skip + query.pageSize);

    return {
      items: paged.map((vo: any) => this.serializeSummary(vo)),
      total: filtered.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getById(user: AuthUser, id: string, tx?: any) {
    const db = tx || this.prisma;
    const vo = await db.variationOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!vo) {
      throw AppException.notFound('NOT_FOUND', 'Variation order not found');
    }
    await this.projectAccessService.assertMember(user, vo.projectId);
    return this.serializeFull(vo);
  }

  async create(user: AuthUser, projectId: string, dto: VariationOrderInput) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { client: true },
    });
    if (!project) {
      throw AppException.notFound('NOT_FOUND', 'Project not found');
    }
    await this.projectAccessService.assertMember(user, projectId);

    const contractCount = await this.prisma.contractItem.count({ where: { projectId } });
    if (contractCount === 0) {
      throw AppException.conflict('CONTRACT_NOT_FOUND', 'The project has no contract yet');
    }

    const existingVoCount = await this.prisma.variationOrder.count({ where: { projectId } });
    const clientCode = project.client
      ? deriveClientCode(project.client.name, project.client.code)
      : 'CLI';
    const { number, shortRef } = formatVariationOrderNumbers(
      project.code,
      project.contractQuoteRef,
      clientCode,
      existingVoCount + 1,
    );

    const calcItems = dto.items.map((it, idx) => {
      const qty = toDecimal(it.quantity);
      const rate = roundMoney(it.rate);
      const amount = formatMoney(roundMoney(qty.mul(rate)));
      return {
        id: it.id || uuidv7(),
        sortOrder: idx,
        description: it.description.trim(),
        unit: it.unit ?? null,
        quantity: formatQuantity(qty),
        rate: formatMoney(rate),
        amount,
      };
    });
    const total = sumMoney(calcItems.map((i) => i.amount));

    return this.prisma.$transaction(async (tx: any) => {
      const id = uuidv7();
      await tx.variationOrder.create({
        data: {
          id,
          number,
          shortRef,
          projectId,
          title: dto.title.trim(),
          reason: dto.reason ?? null,
          status: VariationStatus.DRAFT,
          total,
          createdById: user.id,
        },
      });

      for (const item of calcItems) {
        await tx.variationOrderItem.create({
          data: {
            id: item.id,
            variationOrderId: id,
            sortOrder: item.sortOrder,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount,
          },
        });
      }

      const full = await this.getById(user, id, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'VariationOrder',
          entityId: id,
          action: 'CREATE',
          after: full,
        },
        tx,
      );
      return full;
    });
  }

  async replace(user: AuthUser, id: string, dto: VariationOrderInput) {
    const existing = await this.prisma.variationOrder.findUnique({ where: { id } });
    if (!existing) {
      throw AppException.notFound('NOT_FOUND', 'Variation order not found');
    }
    await this.projectAccessService.assertMember(user, existing.projectId);

    if (existing.status !== VariationStatus.DRAFT) {
      throw AppException.conflict(
        'VARIATION_ORDER_NOT_EDITABLE',
        'Only DRAFT variation orders can be edited',
      );
    }

    const calcItems = dto.items.map((it, idx) => {
      const qty = toDecimal(it.quantity);
      const rate = roundMoney(it.rate);
      const amount = formatMoney(roundMoney(qty.mul(rate)));
      return {
        id: it.id || uuidv7(),
        sortOrder: idx,
        description: it.description.trim(),
        unit: it.unit ?? null,
        quantity: formatQuantity(qty),
        rate: formatMoney(rate),
        amount,
      };
    });
    const total = sumMoney(calcItems.map((i) => i.amount));

    return this.prisma.$transaction(async (tx: any) => {
      await tx.variationOrderItem.deleteMany({ where: { variationOrderId: id } });
      await tx.variationOrder.update({
        where: { id },
        data: {
          title: dto.title.trim(),
          reason: dto.reason ?? null,
          total,
        },
      });

      for (const item of calcItems) {
        await tx.variationOrderItem.create({
          data: {
            id: item.id,
            variationOrderId: id,
            sortOrder: item.sortOrder,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount,
          },
        });
      }

      const full = await this.getById(user, id, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'VariationOrder',
          entityId: id,
          action: 'UPDATE',
          after: full,
        },
        tx,
      );
      return full;
    });
  }

  async submit(user: AuthUser, id: string) {
    const vo = await this.getById(user, id);
    if (vo.status !== VariationStatus.DRAFT) {
      throw AppException.conflict(
        'VARIATION_ORDER_INVALID_STATUS',
        'The variation order is not DRAFT',
      );
    }
    if (!vo.items || vo.items.length === 0) {
      throw AppException.unprocessable(
        'VARIATION_ORDER_HAS_NO_ITEMS',
        'A variation order with no items cannot be submitted',
      );
    }

    return this.prisma.$transaction(async (tx: any) => {
      await tx.variationOrder.update({
        where: { id },
        data: { status: VariationStatus.SUBMITTED },
      });
      const updated = await this.getById(user, id, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'VariationOrder',
          entityId: id,
          action: 'SUBMIT',
          after: updated,
        },
        tx,
      );
      return updated;
    });
  }

  async approve(user: AuthUser, id: string) {
    const vo = await this.getById(user, id);
    if (vo.status !== VariationStatus.SUBMITTED) {
      throw AppException.conflict(
        'VARIATION_ORDER_INVALID_STATUS',
        'The variation order is not SUBMITTED',
      );
    }

    const defaultTax = await this.prisma.taxRate.findFirst({
      where: { isDefault: true, isActive: true },
    });
    const taxPercent = defaultTax ? formatPercent(defaultTax.percent) : '0.00';

    return this.prisma.$transaction(async (tx: any) => {
      await tx.variationOrder.update({
        where: { id },
        data: {
          status: VariationStatus.APPROVED,
          approvedAt: new Date(),
        },
      });

      const currentCount = await tx.contractItem.count({
        where: { projectId: vo.projectId },
      });
      let sortOrder = currentCount;
      const sectionTitle = `${vo.shortRef || vo.number} ${vo.title}`;

      for (const item of vo.items) {
        await tx.contractItem.create({
          data: {
            projectId: vo.projectId,
            variationOrderId: id,
            sectionTitle,
            sortOrder: sortOrder++,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount,
            taxPercent,
            createdById: user.id,
          },
        });
      }

      const updated = await this.getById(user, id, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'VariationOrder',
          entityId: id,
          action: 'APPROVE',
          after: updated,
        },
        tx,
      );
      return updated;
    });
  }

  async reject(user: AuthUser, id: string) {
    const vo = await this.getById(user, id);
    if (vo.status !== VariationStatus.SUBMITTED) {
      throw AppException.conflict(
        'VARIATION_ORDER_INVALID_STATUS',
        'The variation order is not SUBMITTED',
      );
    }

    return this.prisma.$transaction(async (tx: any) => {
      await tx.variationOrder.update({
        where: { id },
        data: { status: VariationStatus.REJECTED },
      });
      const updated = await this.getById(user, id, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'VariationOrder',
          entityId: id,
          action: 'REJECT',
          after: updated,
        },
        tx,
      );
      return updated;
    });
  }
}
