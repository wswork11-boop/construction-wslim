import { Injectable } from '@nestjs/common';
import {
  Decimal,
  deriveClientCode,
  formatMoney,
  formatPercent,
  formatQuantity,
  formatQuotationRevisionRef,
  InvoiceStatus,
  InvoiceType,
  PaginationQuery,
  ProjectCreate,
  ProjectMembersInput,
  ProjectStatus,
  ProjectUpdate,
  QuotationStatus,
  Role,
  sumMoney,
  VariationStatus,
} from '@construction/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { AuthUser } from '../common/decorators';
import { AppException } from '../common/errors';
import { parseSort } from '../common/pagination';
import { ProjectAccessService } from '../common/project-access.service';
import { CompanyService } from '../company/company.service';

function formatDateOnly(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val.slice(0, 10);
  return val.toISOString().slice(0, 10);
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly projectAccessService: ProjectAccessService,
    private readonly companyService: CompanyService,
  ) {}

  serializeProject(project: any, viewerRole: Role, includeMembers = false) {
    const base: any = {
      id: project.id,
      code: project.code,
      name: project.name,
      clientId: project.clientId,
      companyId: project.companyId ?? null,
      ...(project.company
        ? {
            company: {
              id: project.company.id,
              code: project.company.code ?? null,
              name: project.company.name,
            },
          }
        : {}),
      ...(project.client
        ? {
            client: {
              id: project.client.id,
              code: deriveClientCode(project.client.name, project.client.code),
              name: project.client.name,
            },
          }
        : {}),
      contractQuotationId: project.contractQuotationId ?? null,
      contractQuoteRef: project.contractQuoteRef ?? null,
      poNumber: project.poNumber ?? null,
      siteAddress: project.siteAddress ?? null,
      status: project.status,
      startDate: formatDateOnly(project.startDate),
      endDate: formatDateOnly(project.endDate),
      retentionPercent: formatPercent(project.retentionPercent),
      retentionCapPercent: formatPercent(project.retentionCapPercent),
      defectsLiabilityMonths: project.defectsLiabilityMonths,
      createdAt:
        project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt,
      updatedAt:
        project.updatedAt instanceof Date ? project.updatedAt.toISOString() : project.updatedAt,
    };

    // AC4: SITE_STAFF must never receive price or financial fields from the API
    if (viewerRole !== Role.SITE_STAFF) {
      base.contractSum = formatMoney(project.contractSum ?? 0);
    }

    if (includeMembers && Array.isArray(project.members)) {
      base.members = project.members.map((m: any) => ({
        id: m.id,
        projectId: m.projectId,
        userId: m.userId,
        user: m.user
          ? { id: m.user.id, name: m.user.name, role: m.user.role }
          : undefined,
      }));
    }

    return base;
  }

  async list(
    user: AuthUser,
    query: PaginationQuery & { status?: ProjectStatus; clientId?: string; companyId?: string },
  ) {
    const where: any = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.clientId) {
      where.clientId = query.clientId;
    }
    if (query.companyId) {
      where.companyId = query.companyId;
    }
    if (query.q) {
      where.OR = [
        { code: { contains: query.q } },
        { name: { contains: query.q } },
      ];
    }

    // AC4 / Spec 08 AC5: SITE_STAFF and PROJECT_MANAGER only see projects they are a member of
    if (user.role === Role.SITE_STAFF || user.role === Role.PROJECT_MANAGER) {
      where.members = {
        some: { userId: user.id },
      };
    } else if (user.role === Role.OFFICE) {
      // If OFFICE user is explicitly assigned to specific companies, only show projects belonging to their assigned companies
      const accessibleCompanyIds = await this.projectAccessService.getAccessibleCompanyIds(user);
      if (accessibleCompanyIds !== null && accessibleCompanyIds.length > 0) {
        if (query.companyId) {
          if (!accessibleCompanyIds.includes(query.companyId)) {
            return {
              items: [],
              total: 0,
              page: query.page,
              pageSize: query.pageSize,
            };
          }
        } else {
          where.companyId = { in: accessibleCompanyIds };
        }
      }
    }

    const orderBy = parseSort(query.sort, ['createdAt', 'code', 'name', 'status']);
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy,
        skip,
        take: query.pageSize,
        include: { client: true, company: true },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      items: items.map((p) => this.serializeProject(p, user.role, false)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getById(user: AuthUser, id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { client: true, company: true, members: { include: { user: true } } },
    });
    if (!project) {
      throw AppException.notFound('NOT_FOUND', 'Project not found');
    }
    await this.projectAccessService.assertMember(user, id);
    return this.serializeProject(project, user.role, true);
  }

  async create(user: AuthUser, dto: ProjectCreate) {
    const code = dto.code.trim();
    const existingCode = await this.prisma.project.findUnique({ where: { code } });
    if (existingCode) {
      throw AppException.conflict('PROJECT_CODE_TAKEN', 'Another project already has this code');
    }

    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client || !client.isActive) {
      throw AppException.unprocessable(
        'CLIENT_NOT_FOUND',
        'clientId does not exist or the client is inactive',
      );
    }

    const company = await this.companyService.getCompanyById(dto.companyId);

    return this.prisma.$transaction(async (tx: any) => {
      const created = await tx.project.create({
        data: {
          code,
          name: dto.name.trim(),
          clientId: dto.clientId,
          companyId: dto.companyId ?? company.id,
          poNumber: dto.poNumber ?? null,
          siteAddress: dto.siteAddress ?? null,
          status: dto.status ?? 'DRAFT',
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          contractSum: 0,
          retentionPercent: dto.retentionPercent ?? company.defaultRetentionPercent,
          retentionCapPercent: dto.retentionCapPercent ?? company.defaultRetentionCapPercent,
          defectsLiabilityMonths: dto.defectsLiabilityMonths ?? 12,
        },
        include: { client: true, company: true, members: { include: { user: true } } },
      });

      const serialized = this.serializeProject(created, user.role, true);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Project',
          entityId: created.id,
          action: 'CREATE',
          after: serialized,
        },
        tx,
      );
      return serialized;
    });
  }

  async update(user: AuthUser, id: string, dto: ProjectUpdate) {
    const existing = await this.prisma.project.findUnique({
      where: { id },
      include: { client: true, members: { include: { user: true } } },
    });
    if (!existing) {
      throw AppException.notFound('NOT_FOUND', 'Project not found');
    }

    let code: string | undefined;
    if (dto.code !== undefined) {
      code = dto.code.trim();
      if (code !== existing.code) {
        const conflict = await this.prisma.project.findUnique({ where: { code } });
        if (conflict) {
          throw AppException.conflict(
            'PROJECT_CODE_TAKEN',
            'Another project already has this code',
          );
        }
      }
    }

    return this.prisma.$transaction(async (tx: any) => {
      const updated = await tx.project.update({
        where: { id },
        data: {
          ...(code !== undefined ? { code } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
          ...(dto.poNumber !== undefined ? { poNumber: dto.poNumber } : {}),
          ...(dto.siteAddress !== undefined ? { siteAddress: dto.siteAddress } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.startDate !== undefined
            ? { startDate: dto.startDate ? new Date(dto.startDate) : null }
            : {}),
          ...(dto.endDate !== undefined
            ? { endDate: dto.endDate ? new Date(dto.endDate) : null }
            : {}),
          ...(dto.retentionPercent !== undefined
            ? { retentionPercent: dto.retentionPercent }
            : {}),
          ...(dto.retentionCapPercent !== undefined
            ? { retentionCapPercent: dto.retentionCapPercent }
            : {}),
          ...(dto.defectsLiabilityMonths !== undefined
            ? { defectsLiabilityMonths: dto.defectsLiabilityMonths }
            : {}),
        },
        include: { client: true, company: true, members: { include: { user: true } } },
      });

      const serialized = this.serializeProject(updated, user.role, true);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Project',
          entityId: id,
          action: 'UPDATE',
          before: this.serializeProject(existing, user.role, true),
          after: serialized,
        },
        tx,
      );
      return serialized;
    });
  }

  async replaceMembers(user: AuthUser, projectId: string, dto: ProjectMembersInput) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw AppException.notFound('NOT_FOUND', 'Project not found');
    }

    for (const uid of dto.userIds) {
      const u = await this.prisma.user.findUnique({ where: { id: uid } });
      if (!u || !u.isActive) {
        throw AppException.unprocessable(
          'USER_NOT_ASSIGNABLE',
          `User ${uid} does not exist or is inactive`,
        );
      }
    }

    return this.prisma.$transaction(async (tx: any) => {
      await tx.projectMember.deleteMany({ where: { projectId } });
      for (const uid of dto.userIds) {
        await tx.projectMember.create({
          data: { projectId, userId: uid },
        });
      }

      const members = await tx.projectMember.findMany({
        where: { projectId },
        include: { user: true },
      });

      const items = members.map((m: any) => ({
        id: m.id,
        projectId: m.projectId,
        userId: m.userId,
        user: m.user
          ? { id: m.user.id, name: m.user.name, role: m.user.role }
          : undefined,
      }));

      await this.auditService.log(
        {
          userId: user.id,
          entity: 'ProjectMember',
          entityId: projectId,
          action: 'REPLACE_MEMBERS',
          after: { userIds: dto.userIds },
        },
        tx,
      );

      return {
        items,
        total: items.length,
        page: 1,
        pageSize: Math.max(1, items.length),
      };
    });
  }

  async createContractFromQuotation(user: AuthUser, projectId: string, quotationId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw AppException.notFound('NOT_FOUND', 'Project not found');
    }

    const existingItems = await this.prisma.contractItem.count({ where: { projectId } });
    if (existingItems > 0) {
      throw AppException.conflict(
        'CONTRACT_ALREADY_EXISTS',
        'The project already has a contract',
      );
    }

    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { sections: { include: { items: true } } },
    });
    if (!quotation) {
      throw AppException.notFound('NOT_FOUND', 'Quotation not found');
    }
    if (quotation.status !== QuotationStatus.ACCEPTED) {
      throw AppException.conflict(
        'QUOTATION_NOT_ACCEPTED',
        'The quotation is not in status ACCEPTED',
      );
    }
    if (
      quotation.clientId !== project.clientId ||
      (quotation.projectId && quotation.projectId !== projectId)
    ) {
      throw AppException.unprocessable(
        'QUOTATION_CLIENT_MISMATCH',
        'The quotation belongs to another client or another project',
      );
    }

    return this.prisma.$transaction(async (tx: any) => {
      let sortOrder = 0;
      const createdItems: any[] = [];
      for (const sec of quotation.sections || []) {
        for (const item of sec.items || []) {
          const ci = await tx.contractItem.create({
            data: {
              projectId,
              sourceQuotationItemId: item.id,
              sectionTitle: sec.title,
              sortOrder: sortOrder++,
              description: item.description,
              unit: item.unit ?? null,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.amount,
              taxPercent: item.taxPercent,
              createdById: user.id,
            },
          });
          createdItems.push(ci);
        }
      }

      const originalSum = sumMoney(createdItems.map((ci) => ci.amount));
      const contractQuoteRef = formatQuotationRevisionRef(
        quotation.number,
        quotation.revisionNo,
      );

      await tx.project.update({
        where: { id: projectId },
        data: {
          contractSum: originalSum,
          contractQuotationId: quotation.id,
          contractQuoteRef,
          status: project.status === ProjectStatus.DRAFT ? ProjectStatus.ACTIVE : project.status,
        },
      });

      if (!quotation.projectId) {
        await tx.quotation.update({
          where: { id: quotation.id },
          data: { projectId },
        });
      }

      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Contract',
          entityId: projectId,
          action: 'CREATE_FROM_QUOTATION',
          after: { quotationId, contractQuoteRef, originalSum },
        },
        tx,
      );

      return this.getContract(user, projectId, tx);
    });
  }

  async getContract(user: AuthUser, projectId: string, tx?: any) {
    const client = tx || this.prisma;
    const project = await client.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw AppException.notFound('NOT_FOUND', 'Project not found');
    }
    await this.projectAccessService.assertMember(user, projectId);

    const items = await client.contractItem.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    });
    if (items.length === 0) {
      throw AppException.notFound('CONTRACT_NOT_FOUND', 'The project has no contract yet');
    }

    const originalSum = sumMoney(
      items.filter((i: any) => !i.variationOrderId).map((i: any) => i.amount),
    );

    const approvedVos = await client.variationOrder.findMany({
      where: { projectId, status: VariationStatus.APPROVED },
      orderBy: { createdAt: 'asc' },
    });

    const approvedVariationsTotal = sumMoney(approvedVos.map((vo: any) => vo.total));
    const currentSum = sumMoney([originalSum, approvedVariationsTotal]);

    // Latest issued progress claim on this project
    const issuedClaims = await client.invoice.findMany({
      where: {
        projectId,
        type: InvoiceType.PROGRESS_CLAIM,
        status: {
          in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID],
        },
      },
      orderBy: { claimNo: 'desc' },
    });
    const latestClaim = issuedClaims[0] || null;
    const claimedToDate = latestClaim ? formatMoney(latestClaim.grossToDate ?? 0) : '0.00';
    const retentionToDate = latestClaim ? new Decimal(String(latestClaim.retentionToDate ?? 0)) : new Decimal(0);

    // Sum of issued retention release invoices
    const issuedReleases = await client.invoice.findMany({
      where: {
        projectId,
        type: InvoiceType.RETENTION_RELEASE,
        status: {
          in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID],
        },
      },
    });
    const releasedSum = new Decimal(
      sumMoney(issuedReleases.map((r: any) => r.subtotal)),
    );
    const retentionHeld = formatMoney(Decimal.max(new Decimal(0), retentionToDate.sub(releasedSum)));

    return {
      projectId,
      contractQuotationId: project.contractQuotationId ?? null,
      contractQuoteRef: project.contractQuoteRef ?? null,
      poNumber: project.poNumber ?? null,
      items: items.map((i: any) => ({
        id: i.id,
        projectId: i.projectId,
        sourceQuotationItemId: i.sourceQuotationItemId ?? null,
        variationOrderId: i.variationOrderId ?? null,
        sectionTitle: i.sectionTitle ?? null,
        sortOrder: i.sortOrder,
        description: i.description,
        unit: i.unit ?? null,
        quantity: formatQuantity(i.quantity),
        rate: formatMoney(i.rate),
        amount: formatMoney(i.amount),
        taxPercent: formatPercent(i.taxPercent),
      })),
      originalSum,
      approvedVariationOrders: approvedVos.map((vo: any) => ({
        id: vo.id,
        number: vo.number,
        shortRef: vo.shortRef ?? null,
        projectId: vo.projectId,
        title: vo.title,
        reason: vo.reason ?? null,
        status: vo.status,
        approvedAt: vo.approvedAt instanceof Date ? vo.approvedAt.toISOString() : vo.approvedAt ?? null,
        total: formatMoney(vo.total),
        createdById: vo.createdById,
        createdAt: vo.createdAt instanceof Date ? vo.createdAt.toISOString() : vo.createdAt,
        updatedAt: vo.updatedAt instanceof Date ? vo.updatedAt.toISOString() : vo.updatedAt,
      })),
      approvedVariationsTotal,
      currentSum,
      claimedToDate,
      retentionHeld,
    };
  }
}
