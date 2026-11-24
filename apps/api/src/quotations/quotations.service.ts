import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import {
  deriveClientCode,
  deriveProjectCodeFromQuotation,
  formatMoney,
  formatPercent,
  formatQuantity,
  formatQuotationBaseNumber,
  formatQuotationRevisionRef,
  PaginationQuery,
  ProjectStatus,
  QuotationAcceptRequest,
  QuotationCalculator,
  QuotationInput,
  QuotationRejectRequest,
  QuotationStatus,
  Role,
  sumMoney,
} from '@construction/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { AuthUser } from '../common/decorators';
import { AppException } from '../common/errors';
import { ProjectAccessService } from '../common/project-access.service';
import { CompanyService } from '../company/company.service';
import { SequenceService } from '../company/sequence.service';
import { FilesService } from '../files/files.service';
import { PdfService } from '../pdf/pdf.service';

function formatDateOnly(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val.slice(0, 10);
  return val.toISOString().slice(0, 10);
}

function getKlTodayString(): string {
  const now = new Date();
  const klMs = now.getTime() + 8 * 60 * 60 * 1000;
  return new Date(klMs).toISOString().slice(0, 10);
}

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequenceService: SequenceService,
    private readonly companyService: CompanyService,
    private readonly filesService: FilesService,
    private readonly pdfService: PdfService,
    private readonly auditService: AuditService,
    private readonly projectAccessService: ProjectAccessService,
  ) {}

  computeStatus(quotation: any): QuotationStatus {
    // AC6: A SENT quotation past validUntil is shown as EXPIRED
    if (quotation.status === QuotationStatus.SENT && quotation.validUntil) {
      const validStr = formatDateOnly(quotation.validUntil);
      const todayStr = getKlTodayString();
      if (validStr && validStr < todayStr) {
        return QuotationStatus.EXPIRED;
      }
    }
    return quotation.status;
  }

  serializeSummary(q: any) {
    const resolvedCompany = q.company || q.project?.company || null;
    const resolvedCompanyId = q.companyId ?? q.project?.companyId ?? resolvedCompany?.id ?? null;
    return {
      id: q.id,
      number: q.number,
      displayNumber: formatQuotationRevisionRef(q.number, q.revisionNo),
      rootId: q.rootId,
      revisionNo: q.revisionNo,
      clientId: q.clientId,
      companyId: resolvedCompanyId,
      ...(resolvedCompany
        ? {
            company: {
              id: resolvedCompany.id,
              code: resolvedCompany.code ?? null,
              name: resolvedCompany.name,
            },
          }
        : {}),
      ...(q.client
        ? {
            client: {
              id: q.client.id,
              code: deriveClientCode(q.client.name, q.client.code),
              name: q.client.name,
            },
          }
        : {}),
      projectId: q.projectId ?? null,
      title: q.title,
      status: this.computeStatus(q),
      issueDate: formatDateOnly(q.issueDate),
      validUntil: formatDateOnly(q.validUntil),
      subtotal: formatMoney(q.subtotal),
      discountAmount: formatMoney(q.discountAmount),
      taxAmount: formatMoney(q.taxAmount),
      total: formatMoney(q.total),
      createdById: q.createdById,
      createdAt: q.createdAt instanceof Date ? q.createdAt.toISOString() : q.createdAt,
      updatedAt: q.updatedAt instanceof Date ? q.updatedAt.toISOString() : q.updatedAt,
    };
  }

  serializeFull(q: any) {
    const sections = (q.sections || []).map((sec: any) => {
      const items = (sec.items || []).map((item: any) => ({
        id: item.id,
        quotationId: item.quotationId,
        sectionId: item.sectionId,
        sortOrder: item.sortOrder,
        description: item.description,
        unit: item.unit ?? null,
        quantity: formatQuantity(item.quantity),
        rate: formatMoney(item.rate),
        amount: formatMoney(item.amount),
        taxRateId: item.taxRateId ?? null,
        taxPercent: formatPercent(item.taxPercent),
      }));
      const secSubtotal = items.reduce(
        (acc: number, it: any) => acc + Number(it.amount),
        0,
      );
      return {
        id: sec.id,
        quotationId: sec.quotationId,
        sortOrder: sec.sortOrder,
        title: sec.title,
        subtotal: formatMoney(secSubtotal),
        items,
      };
    });

    return {
      ...this.serializeSummary(q),
      terms: q.terms ?? null,
      notes: q.notes ?? null,
      pdfFileId: q.pdfFileId ?? null,
      rejectionReason: q.rejectionReason ?? null,
      sections,
    };
  }

  private async resolveTaxRates(sections: QuotationInput['sections'], tx?: any) {
    const client = tx || this.prisma;
    const taxRateMap = new Map<string, string>();
    for (const sec of sections) {
      for (const item of sec.items) {
        if (item.taxRateId && !taxRateMap.has(item.taxRateId)) {
          const tr = await client.taxRate.findUnique({ where: { id: item.taxRateId } });
          if (!tr || !tr.isActive) {
            throw AppException.unprocessable(
              'TAX_RATE_NOT_FOUND',
              `Tax rate ${item.taxRateId} does not exist or is inactive`,
            );
          }
          taxRateMap.set(item.taxRateId, formatPercent(tr.percent));
        }
      }
    }
    return taxRateMap;
  }

  async list(
    user: AuthUser,
    query: PaginationQuery & {
      status?: QuotationStatus;
      clientId?: string;
      companyId?: string;
      projectId?: string;
      from?: string;
      to?: string;
      latestOnly?: boolean;
    },
  ) {
    const all = await this.prisma.quotation.findMany({
      include: { client: true, company: true, project: { include: { company: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const accessibleCompanyIds = await this.projectAccessService.getAccessibleCompanyIds(user);

    let allowedProjectIds: Set<string> | null = null;
    if (user.role === Role.PROJECT_MANAGER) {
      const memberships = await this.prisma.projectMember.findMany({
        where: { userId: user.id },
      });
      allowedProjectIds = new Set(memberships.map((m: any) => m.projectId));
    }

    let filtered = all.filter((q: any) => {
      const qCompId = q.companyId ?? q.project?.companyId ?? null;
      if (accessibleCompanyIds !== null && accessibleCompanyIds.length > 0) {
        if (!qCompId || !accessibleCompanyIds.includes(qCompId)) {
          return false;
        }
      }
      if (query.companyId && qCompId !== query.companyId) return false;
      if (allowedProjectIds && (!q.projectId || !allowedProjectIds.has(q.projectId))) {
        return false;
      }
      if (query.clientId && q.clientId !== query.clientId) return false;
      if (query.projectId && q.projectId !== query.projectId) return false;
      const effectiveStatus = this.computeStatus(q);
      if (query.status && effectiveStatus !== query.status) return false;
      const issueStr = formatDateOnly(q.issueDate);
      if (query.from && issueStr && issueStr < query.from) return false;
      if (query.to && issueStr && issueStr > query.to) return false;
      if (query.q) {
        const needle = query.q.toLowerCase();
        const matchNumber = String(q.number).toLowerCase().includes(needle);
        const matchTitle = String(q.title).toLowerCase().includes(needle);
        const matchClient = String(q.client?.name || '')
          .toLowerCase()
          .includes(needle);
        if (!matchNumber && !matchTitle && !matchClient) return false;
      }
      return true;
    });

    if (query.latestOnly !== false) {
      const maxRevByRoot = new Map<string, number>();
      for (const q of all) {
        const cur = maxRevByRoot.get(q.rootId) ?? -1;
        if (q.revisionNo > cur) {
          maxRevByRoot.set(q.rootId, q.revisionNo);
        }
      }
      filtered = filtered.filter((q: any) => q.revisionNo === maxRevByRoot.get(q.rootId));
    }

    const total = filtered.length;
    const skip = (query.page - 1) * query.pageSize;
    const paged = filtered.slice(skip, skip + query.pageSize);

    return {
      items: paged.map((q: any) => this.serializeSummary(q)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getById(user: AuthUser, id: string, tx?: any) {
    const db = tx || this.prisma;
    const q = await db.quotation.findUnique({
      where: { id },
      include: {
        client: true,
        company: true,
        project: { include: { company: true } },
        sections: { include: { items: true } },
      },
    });
    if (!q) {
      throw AppException.notFound('NOT_FOUND', 'Quotation not found');
    }
    if (user.role === Role.PROJECT_MANAGER) {
      if (!q.projectId) {
        throw AppException.forbidden('FORBIDDEN', 'You do not have access to this quotation');
      }
      await this.projectAccessService.assertMember(user, q.projectId);
    }
    return this.serializeFull(q);
  }

  async create(user: AuthUser, dto: QuotationInput) {
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client || !client.isActive) {
      throw AppException.unprocessable(
        'CLIENT_NOT_FOUND',
        'clientId does not exist or the client is inactive',
      );
    }

    const clientCode = deriveClientCode(client.name, client.code);
    const project = dto.projectId
      ? await this.prisma.project.findUnique({ where: { id: dto.projectId } })
      : null;
    const fallbackCompany = await this.companyService.getCompany(user);
    const resolvedCompanyId = dto.companyId ?? project?.companyId ?? fallbackCompany.id;

    const taxRateMap = await this.resolveTaxRates(dto.sections);
    const calculated = QuotationCalculator.calculate({
      discountAmount: dto.discountAmount ?? '0.00',
      sections: dto.sections.map((s) => ({
        id: s.id,
        title: s.title,
        items: s.items.map((i) => ({
          id: i.id,
          description: i.description,
          unit: i.unit ?? null,
          quantity: i.quantity,
          rate: i.rate,
          taxRateId: i.taxRateId ?? null,
          taxPercent: i.taxRateId ? taxRateMap.get(i.taxRateId) ?? '0.00' : '0.00',
        })),
      })),
    });

    return this.prisma.$transaction(async (tx: any) => {
      const id = uuidv7();
      const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date(getKlTodayString());
      const rawSeq = await this.sequenceService.next('QT', tx, issueDate.getUTCFullYear());
      const number = formatQuotationBaseNumber(rawSeq, clientCode);

      await tx.quotation.create({
        data: {
          id,
          number,
          rootId: id,
          revisionNo: 0,
          clientId: dto.clientId,
          companyId: resolvedCompanyId,
          projectId: dto.projectId ?? null,
          title: dto.title.trim(),
          status: QuotationStatus.DRAFT,
          issueDate,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          terms: dto.terms ?? null,
          notes: dto.notes ?? null,
          subtotal: calculated.subtotal,
          discountAmount: calculated.discountAmount,
          taxAmount: calculated.taxAmount,
          total: calculated.total,
          createdById: user.id,
        },
      });

      for (const sec of calculated.sections) {
        const createdSec = await tx.quotationSection.create({
          data: {
            id: sec.id || uuidv7(),
            quotationId: id,
            sortOrder: sec.sortOrder,
            title: sec.title,
          },
        });
        for (const item of sec.items) {
          await tx.quotationItem.create({
            data: {
              id: item.id || uuidv7(),
              quotationId: id,
              sectionId: createdSec.id,
              sortOrder: item.sortOrder,
              description: item.description,
              unit: item.unit,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.amount,
              taxRateId: item.taxRateId,
              taxPercent: item.taxPercent,
            },
          });
        }
      }

      const full = await this.getById(user, id, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Quotation',
          entityId: id,
          action: 'CREATE',
          after: full,
        },
        tx,
      );
      return full;
    });
  }

  async replace(user: AuthUser, id: string, dto: QuotationInput) {
    const existing = await this.prisma.quotation.findUnique({
      where: { id },
      include: { sections: true },
    });
    if (!existing) {
      throw AppException.notFound('NOT_FOUND', 'Quotation not found');
    }
    if (existing.status !== QuotationStatus.DRAFT) {
      throw AppException.conflict(
        'QUOTATION_NOT_EDITABLE',
        'Only DRAFT quotations can be edited',
      );
    }

    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client || !client.isActive) {
      throw AppException.unprocessable(
        'CLIENT_NOT_FOUND',
        'clientId does not exist or the client is inactive',
      );
    }

    const taxRateMap = await this.resolveTaxRates(dto.sections);
    const calculated = QuotationCalculator.calculate({
      discountAmount: dto.discountAmount ?? '0.00',
      sections: dto.sections.map((s) => ({
        id: s.id,
        title: s.title,
        items: s.items.map((i) => ({
          id: i.id,
          description: i.description,
          unit: i.unit ?? null,
          quantity: i.quantity,
          rate: i.rate,
          taxRateId: i.taxRateId ?? null,
          taxPercent: i.taxRateId ? taxRateMap.get(i.taxRateId) ?? '0.00' : '0.00',
        })),
      })),
    });

    return this.prisma.$transaction(async (tx: any) => {
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      await tx.quotationSection.deleteMany({ where: { quotationId: id } });

      await tx.quotation.update({
        where: { id },
        data: {
          clientId: dto.clientId,
          ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
          projectId: dto.projectId ?? null,
          title: dto.title.trim(),
          issueDate: dto.issueDate ? new Date(dto.issueDate) : existing.issueDate,
          validUntil:
            dto.validUntil !== undefined
              ? dto.validUntil
                ? new Date(dto.validUntil)
                : null
              : existing.validUntil,
          terms: dto.terms ?? null,
          notes: dto.notes ?? null,
          subtotal: calculated.subtotal,
          discountAmount: calculated.discountAmount,
          taxAmount: calculated.taxAmount,
          total: calculated.total,
        },
      });

      for (const sec of calculated.sections) {
        const createdSec = await tx.quotationSection.create({
          data: {
            id: sec.id || uuidv7(),
            quotationId: id,
            sortOrder: sec.sortOrder,
            title: sec.title,
          },
        });
        for (const item of sec.items) {
          await tx.quotationItem.create({
            data: {
              id: item.id || uuidv7(),
              quotationId: id,
              sectionId: createdSec.id,
              sortOrder: item.sortOrder,
              description: item.description,
              unit: item.unit,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.amount,
              taxRateId: item.taxRateId,
              taxPercent: item.taxPercent,
            },
          });
        }
      }

      const full = await this.getById(user, id, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Quotation',
          entityId: id,
          action: 'UPDATE',
          after: full,
        },
        tx,
      );
      return full;
    });
  }

  async delete(user: AuthUser, id: string) {
    const existing = await this.prisma.quotation.findUnique({ where: { id } });
    if (!existing) {
      throw AppException.notFound('NOT_FOUND', 'Quotation not found');
    }
    if (existing.status !== QuotationStatus.DRAFT || existing.revisionNo !== 0) {
      throw AppException.conflict(
        'QUOTATION_NOT_DELETABLE',
        'Only a DRAFT quotation with revisionNo 0 can be deleted',
      );
    }

    await this.prisma.$transaction(async (tx: any) => {
      await tx.quotation.delete({ where: { id } });
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Quotation',
          entityId: id,
          action: 'DELETE',
          before: { id, number: existing.number },
        },
        tx,
      );
    });
  }

  async send(user: AuthUser, id: string) {
    const quotation = await this.getById(user, id);
    if (quotation.status !== QuotationStatus.DRAFT) {
      throw AppException.conflict('QUOTATION_INVALID_STATUS', 'The quotation is not DRAFT');
    }

    const totalItems = quotation.sections.reduce(
      (acc: number, s: any) => acc + (s.items?.length || 0),
      0,
    );
    if (totalItems === 0) {
      throw AppException.unprocessable(
        'QUOTATION_HAS_NO_ITEMS',
        'A quotation with no items cannot be sent',
      );
    }

    const project = quotation.projectId
      ? await this.prisma.project.findUnique({ where: { id: quotation.projectId } })
      : null;
    const company = await this.companyService.getCompanyById(
      quotation.companyId ?? project?.companyId,
    );
    const client = await this.prisma.client.findUnique({ where: { id: quotation.clientId } });

    const html = this.pdfService.renderQuotationHtml({
      company,
      client,
      project,
      quotation,
    });
    const pdfBuffer = await this.pdfService.renderHtmlToPdf(
      `Quotation ${quotation.displayNumber}`,
      html,
    );

    return this.prisma.$transaction(async (tx: any) => {
      const pdfFile = await this.filesService.storeBuffer(
        pdfBuffer,
        {
          fileName: `${quotation.displayNumber}.pdf`,
          mimeType: 'application/pdf',
          purpose: 'DOCUMENT_PDF',
          uploadedById: user.id,
        },
        tx,
      );

      await tx.quotation.update({
        where: { id },
        data: {
          status: QuotationStatus.SENT,
          pdfFileId: pdfFile.id,
        },
      });

      const updated = await this.getById(user, id, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Quotation',
          entityId: id,
          action: 'SEND',
          after: updated,
        },
        tx,
      );
      return updated;
    });
  }

  private async isLatestRevision(q: any, tx?: any): Promise<boolean> {
    const db = tx || this.prisma;
    const revisions = await db.quotation.findMany({
      where: { rootId: q.rootId },
    });
    const maxRev = Math.max(...revisions.map((r: any) => r.revisionNo));
    return q.revisionNo === maxRev;
  }

  async accept(user: AuthUser, id: string, opts?: QuotationAcceptRequest) {
    const q = await this.prisma.quotation.findUnique({
      where: { id },
      include: { sections: { include: { items: true } } },
    });
    if (!q) {
      throw AppException.notFound('NOT_FOUND', 'Quotation not found');
    }
    if (!(await this.isLatestRevision(q))) {
      throw AppException.conflict(
        'QUOTATION_NOT_LATEST_REVISION',
        'Only the latest revision can be accepted',
      );
    }
    const effectiveStatus = this.computeStatus(q);
    if (effectiveStatus !== QuotationStatus.SENT) {
      throw AppException.conflict(
        'QUOTATION_INVALID_STATUS',
        'The quotation is not SENT or has expired',
      );
    }

    const company = await this.companyService.getCompanyById(q.companyId);

    return this.prisma.$transaction(async (tx: any) => {
      let targetProjectId = q.projectId;
      const contractQuoteRef = formatQuotationRevisionRef(q.number, q.revisionNo);

      if (opts?.createProject || opts?.projectCode) {
        const derivedCode = opts?.projectCode || deriveProjectCodeFromQuotation(q.number);
        let existingProj = await tx.project.findUnique({ where: { code: derivedCode } });
        if (!existingProj) {
          existingProj = await tx.project.create({
            data: {
              code: derivedCode,
              name: q.title,
              clientId: q.clientId,
              companyId: q.companyId ?? company.id,
              contractQuotationId: q.id,
              contractQuoteRef,
              poNumber: opts?.poNumber ?? null,
              status: ProjectStatus.ACTIVE,
              contractSum: 0,
              retentionPercent: company.defaultRetentionPercent,
              retentionCapPercent: company.defaultRetentionCapPercent,
              defectsLiabilityMonths: 12,
            },
          });
        }
        targetProjectId = existingProj.id;

        const existingContractCount = await tx.contractItem.count({
          where: { projectId: targetProjectId },
        });
        if (existingContractCount === 0) {
          let sortOrder = 0;
          const createdItems: any[] = [];
          for (const sec of q.sections || []) {
            for (const item of sec.items || []) {
              const ci = await tx.contractItem.create({
                data: {
                  projectId: targetProjectId,
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
          await tx.project.update({
            where: { id: targetProjectId },
            data: {
              contractSum: originalSum,
              contractQuotationId: q.id,
              contractQuoteRef,
              ...(opts?.poNumber !== undefined ? { poNumber: opts.poNumber } : {}),
            },
          });
        }
      }

      await tx.quotation.update({
        where: { id },
        data: {
          status: QuotationStatus.ACCEPTED,
          ...(targetProjectId ? { projectId: targetProjectId } : {}),
        },
      });
      const updated = await this.getById(user, id, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Quotation',
          entityId: id,
          action: 'ACCEPT',
          after: updated,
        },
        tx,
      );
      return updated;
    });
  }

  async reject(user: AuthUser, id: string, dto: QuotationRejectRequest) {
    const q = await this.prisma.quotation.findUnique({ where: { id } });
    if (!q) {
      throw AppException.notFound('NOT_FOUND', 'Quotation not found');
    }
    if (q.status !== QuotationStatus.SENT) {
      throw AppException.conflict('QUOTATION_INVALID_STATUS', 'The quotation is not SENT');
    }

    return this.prisma.$transaction(async (tx: any) => {
      await tx.quotation.update({
        where: { id },
        data: {
          status: QuotationStatus.REJECTED,
          rejectionReason: dto.reason.trim(),
        },
      });
      const updated = await this.getById(user, id, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Quotation',
          entityId: id,
          action: 'REJECT',
          after: updated,
        },
        tx,
      );
      return updated;
    });
  }

  async revise(user: AuthUser, id: string) {
    const source = await this.getById(user, id);
    const rawSource = await this.prisma.quotation.findUnique({ where: { id } });
    if (!rawSource) {
      throw AppException.notFound('NOT_FOUND', 'Quotation not found');
    }

    if (
      rawSource.status !== QuotationStatus.SENT &&
      rawSource.status !== QuotationStatus.REJECTED
    ) {
      throw AppException.conflict(
        'QUOTATION_INVALID_STATUS',
        'Only SENT or REJECTED quotations can be revised',
      );
    }
    if (!(await this.isLatestRevision(rawSource))) {
      throw AppException.conflict(
        'QUOTATION_NOT_LATEST_REVISION',
        'A newer revision already exists',
      );
    }

    return this.prisma.$transaction(async (tx: any) => {
      await tx.quotation.update({
        where: { id },
        data: { status: QuotationStatus.SUPERSEDED },
      });

      const newId = uuidv7();
      const newRevNo = rawSource.revisionNo + 1;

      await tx.quotation.create({
        data: {
          id: newId,
          number: rawSource.number,
          rootId: rawSource.rootId,
          revisionNo: newRevNo,
          clientId: rawSource.clientId,
          companyId: rawSource.companyId ?? null,
          projectId: rawSource.projectId,
          title: rawSource.title,
          status: QuotationStatus.DRAFT,
          issueDate: rawSource.issueDate,
          validUntil: rawSource.validUntil,
          terms: rawSource.terms,
          notes: rawSource.notes,
          subtotal: rawSource.subtotal,
          discountAmount: rawSource.discountAmount,
          taxAmount: rawSource.taxAmount,
          total: rawSource.total,
          createdById: user.id,
        },
      });

      for (const sec of source.sections) {
        const newSec = await tx.quotationSection.create({
          data: {
            id: uuidv7(),
            quotationId: newId,
            sortOrder: sec.sortOrder,
            title: sec.title,
          },
        });
        for (const item of sec.items) {
          await tx.quotationItem.create({
            data: {
              id: uuidv7(),
              quotationId: newId,
              sectionId: newSec.id,
              sortOrder: item.sortOrder,
              description: item.description,
              unit: item.unit,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.amount,
              taxRateId: item.taxRateId,
              taxPercent: item.taxPercent,
            },
          });
        }
      }

      const created = await this.getById(user, newId, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Quotation',
          entityId: newId,
          action: 'REVISE',
          before: { sourceId: id, revisionNo: rawSource.revisionNo },
          after: created,
        },
        tx,
      );
      return created;
    });
  }

  async duplicate(user: AuthUser, id: string) {
    const source = await this.getById(user, id);
    const rawSource = await this.prisma.quotation.findUnique({ where: { id } });
    if (!rawSource) {
      throw AppException.notFound('NOT_FOUND', 'Quotation not found');
    }
    const client = await this.prisma.client.findUnique({ where: { id: rawSource.clientId } });
    const clientCode = client ? deriveClientCode(client.name, client.code) : 'CLI';

    return this.prisma.$transaction(async (tx: any) => {
      const newId = uuidv7();
      const issueDate = new Date(getKlTodayString());
      const rawSeq = await this.sequenceService.next('QT', tx, issueDate.getUTCFullYear());
      const newNumber = formatQuotationBaseNumber(rawSeq, clientCode);

      await tx.quotation.create({
        data: {
          id: newId,
          number: newNumber,
          rootId: newId,
          revisionNo: 0,
          clientId: rawSource.clientId,
          companyId: rawSource.companyId ?? null,
          projectId: rawSource.projectId,
          title: rawSource.title,
          status: QuotationStatus.DRAFT,
          issueDate,
          validUntil: rawSource.validUntil,
          terms: rawSource.terms,
          notes: rawSource.notes,
          subtotal: rawSource.subtotal,
          discountAmount: rawSource.discountAmount,
          taxAmount: rawSource.taxAmount,
          total: rawSource.total,
          createdById: user.id,
        },
      });

      for (const sec of source.sections) {
        const newSec = await tx.quotationSection.create({
          data: {
            id: uuidv7(),
            quotationId: newId,
            sortOrder: sec.sortOrder,
            title: sec.title,
          },
        });
        for (const item of sec.items) {
          await tx.quotationItem.create({
            data: {
              id: uuidv7(),
              quotationId: newId,
              sectionId: newSec.id,
              sortOrder: item.sortOrder,
              description: item.description,
              unit: item.unit,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.amount,
              taxRateId: item.taxRateId,
              taxPercent: item.taxPercent,
            },
          });
        }
      }

      const created = await this.getById(user, newId, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Quotation',
          entityId: newId,
          action: 'DUPLICATE',
          before: { sourceId: id },
          after: created,
        },
        tx,
      );
      return created;
    });
  }

  async listRevisions(user: AuthUser, id: string, query: PaginationQuery) {
    const q = await this.getById(user, id);
    const allRevs = await this.prisma.quotation.findMany({
      where: { rootId: q.rootId },
      include: { client: true },
      orderBy: { revisionNo: 'desc' },
    });

    const skip = (query.page - 1) * query.pageSize;
    const paged = allRevs.slice(skip, skip + query.pageSize);
    return {
      items: paged.map((r: any) => this.serializeSummary(r)),
      total: allRevs.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getPdfUrl(user: AuthUser, id: string) {
    const quotation = await this.getById(user, id);
    if (quotation.status !== QuotationStatus.DRAFT && quotation.pdfFileId) {
      return this.filesService.getDownloadUrl(quotation.pdfFileId);
    }

    const project = quotation.projectId
      ? await this.prisma.project.findUnique({ where: { id: quotation.projectId } })
      : null;
    const company = await this.companyService.getCompanyById(
      quotation.companyId ?? project?.companyId,
    );
    const client = await this.prisma.client.findUnique({ where: { id: quotation.clientId } });

    const html = this.pdfService.renderQuotationHtml({
      company,
      client,
      project,
      quotation,
      watermark: quotation.status === QuotationStatus.DRAFT ? 'DRAFT' : undefined,
    });
    const pdfBuffer = await this.pdfService.renderHtmlToPdf(
      `Quotation Preview ${quotation.displayNumber}`,
      html,
    );
    const previewFile = await this.filesService.storeBuffer(pdfBuffer, {
      fileName: `${quotation.displayNumber}-preview.pdf`,
      mimeType: 'application/pdf',
      purpose: 'DOCUMENT_PDF',
      uploadedById: user.id,
    });

    return this.filesService.getDownloadUrl(previewFile.id);
  }
}
