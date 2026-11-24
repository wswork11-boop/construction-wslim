import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import {
  ClaimCalculationError,
  ClaimCalculator,
  CreditNoteCreate,
  Decimal,
  deriveClientCode,
  formatMoney,
  formatPercent,
  formatQuantity,
  formatTaxInvoiceNumber,
  InvoiceStatus,
  InvoiceType,
  InvoiceVoidRequest,
  PaginationQuery,
  PaymentCreate,
  ProgressClaimCreate,
  ProgressClaimUpdate,
  RetentionReleaseCreate,
  RetentionReleaseUpdate,
  Role,
  roundMoney,
  SimpleInvoiceCreate,
  SimpleInvoiceUpdate,
  sumMoney,
  toDecimal,
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

function addDaysToYmd(ymd: string, days: number): string {
  const ms = new Date(`${ymd}T00:00:00.000Z`).getTime() + days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequenceService: SequenceService,
    private readonly companyService: CompanyService,
    private readonly filesService: FilesService,
    private readonly pdfService: PdfService,
    private readonly auditService: AuditService,
    private readonly projectAccessService: ProjectAccessService,
  ) {}

  serializeSummary(inv: any) {
    return {
      id: inv.id,
      number: inv.number ?? null,
      type: inv.type,
      projectId: inv.projectId ?? null,
      ...(inv.project
        ? {
            project: {
              id: inv.project.id,
              code: inv.project.code,
              name: inv.project.name,
            },
          }
        : { project: null }),
      clientId: inv.clientId,
      ...(inv.client
        ? {
            client: {
              id: inv.client.id,
              code: deriveClientCode(inv.client.name, inv.client.code),
              name: inv.client.name,
            },
          }
        : {}),
      status: inv.status,
      issueDate: formatDateOnly(inv.issueDate),
      dueDate: formatDateOnly(inv.dueDate),
      claimNo: inv.claimNo ?? null,
      progressReportId: inv.progressReportId ?? null,
      projectCodeRef: inv.projectCodeRef ?? inv.project?.code ?? null,
      quotePoRef: inv.quotePoRef ?? inv.project?.contractQuoteRef ?? null,
      claimReportRef: inv.claimReportRef ?? null,
      referenceSummary: inv.referenceSummary ?? null,
      periodFrom: formatDateOnly(inv.periodFrom),
      periodTo: formatDateOnly(inv.periodTo),
      grossToDate: inv.grossToDate !== null && inv.grossToDate !== undefined ? formatMoney(inv.grossToDate) : null,
      retentionToDate:
        inv.retentionToDate !== null && inv.retentionToDate !== undefined
          ? formatMoney(inv.retentionToDate)
          : null,
      previousNetCertified:
        inv.previousNetCertified !== null && inv.previousNetCertified !== undefined
          ? formatMoney(inv.previousNetCertified)
          : null,
      taxPercent:
        inv.taxPercent !== null && inv.taxPercent !== undefined
          ? formatPercent(inv.taxPercent)
          : null,
      subtotal: formatMoney(inv.subtotal),
      taxAmount: formatMoney(inv.taxAmount),
      total: formatMoney(inv.total),
      amountPaid: formatMoney(inv.amountPaid),
      eInvoiceStatus: inv.eInvoiceStatus,
      createdById: inv.createdById,
      createdAt: inv.createdAt instanceof Date ? inv.createdAt.toISOString() : inv.createdAt,
      updatedAt: inv.updatedAt instanceof Date ? inv.updatedAt.toISOString() : inv.updatedAt,
    };
  }

  async serializeFull(inv: any, tx?: any) {
    const db = tx || this.prisma;
    const siteProgressMap = new Map<string, string>();
    if (inv.projectId) {
      const siteRows = await db.dailyReportProgress.findMany({
        orderBy: { createdAt: 'desc' },
      });
      for (const r of siteRows) {
        if (!siteProgressMap.has(r.contractItemId)) {
          siteProgressMap.set(r.contractItemId, formatPercent(r.percentComplete));
        }
      }
    }

    const buyer =
      inv.buyerName !== null && inv.buyerName !== undefined
        ? {
            name: inv.buyerName,
            registrationNo: inv.buyerRegistrationNo ?? null,
            tin: inv.buyerTin ?? null,
            sstNo: inv.buyerSstNo ?? null,
            address: inv.buyerAddress ?? null,
          }
        : null;

    const supplier =
      inv.supplierName !== null && inv.supplierName !== undefined
        ? {
            name: inv.supplierName,
            registrationNo: inv.supplierRegistrationNo ?? null,
            tin: inv.supplierTin ?? null,
            sstNo: inv.supplierSstNo ?? null,
            msicCode: inv.supplierMsicCode ?? null,
            address: inv.supplierAddress ?? null,
          }
        : null;

    return {
      ...this.serializeSummary(inv),
      notes: inv.notes ?? null,
      pdfFileId: inv.pdfFileId ?? null,
      voidReason: inv.voidReason ?? null,
      voidedAt: inv.voidedAt instanceof Date ? inv.voidedAt.toISOString() : inv.voidedAt ?? null,
      buyer,
      supplier,
      eInvoiceUuid: inv.eInvoiceUuid ?? null,
      eInvoiceLongId: inv.eInvoiceLongId ?? null,
      eInvoiceValidatedAt:
        inv.eInvoiceValidatedAt instanceof Date
          ? inv.eInvoiceValidatedAt.toISOString()
          : inv.eInvoiceValidatedAt ?? null,
      lines: (inv.lines || []).map((l: any) => ({
        id: l.id,
        invoiceId: l.invoiceId,
        sortOrder: l.sortOrder,
        description: l.description,
        unit: l.unit ?? null,
        quantity: formatQuantity(l.quantity),
        rate: formatMoney(l.rate),
        amount: formatMoney(l.amount),
        taxPercent: formatPercent(l.taxPercent),
        taxAmount: formatMoney(l.taxAmount),
        classificationCode: l.classificationCode ?? null,
      })),
      claimLines: (inv.claimLines || []).map((cl: any) => ({
        id: cl.id,
        invoiceId: cl.invoiceId,
        contractItemId: cl.contractItemId,
        ...(cl.contractItem
          ? {
              contractItem: {
                id: cl.contractItem.id,
                projectId: cl.contractItem.projectId,
                sourceQuotationItemId: cl.contractItem.sourceQuotationItemId ?? null,
                variationOrderId: cl.contractItem.variationOrderId ?? null,
                sectionTitle: cl.contractItem.sectionTitle ?? null,
                sortOrder: cl.contractItem.sortOrder,
                description: cl.contractItem.description,
                unit: cl.contractItem.unit ?? null,
                quantity: formatQuantity(cl.contractItem.quantity),
                rate: formatMoney(cl.contractItem.rate),
                amount: formatMoney(cl.contractItem.amount),
                taxPercent: formatPercent(cl.contractItem.taxPercent),
              },
            }
          : {}),
        cumulativePercent: formatPercent(cl.cumulativePercent),
        cumulativeQuantity: formatQuantity(cl.cumulativeQuantity),
        cumulativeAmount: formatMoney(cl.cumulativeAmount),
        previousAmount: formatMoney(cl.previousAmount),
        thisClaimAmount: formatMoney(cl.thisClaimAmount),
        siteReportedPercent: siteProgressMap.get(cl.contractItemId) ?? null,
      })),
      creditNotes: (inv.creditNotes || []).map((cn: any) => this.serializeCreditNote(cn)),
    };
  }

  serializeCreditNote(cn: any) {
    return {
      id: cn.id,
      number: cn.number,
      invoiceId: cn.invoiceId,
      issueDate: formatDateOnly(cn.issueDate),
      reason: cn.reason,
      subtotal: formatMoney(cn.subtotal),
      taxAmount: formatMoney(cn.taxAmount),
      total: formatMoney(cn.total),
      eInvoiceStatus: cn.eInvoiceStatus,
      eInvoiceUuid: cn.eInvoiceUuid ?? null,
      eInvoiceLongId: cn.eInvoiceLongId ?? null,
      eInvoiceValidatedAt:
        cn.eInvoiceValidatedAt instanceof Date
          ? cn.eInvoiceValidatedAt.toISOString()
          : cn.eInvoiceValidatedAt ?? null,
      createdById: cn.createdById,
      createdAt: cn.createdAt instanceof Date ? cn.createdAt.toISOString() : cn.createdAt,
      updatedAt: cn.updatedAt instanceof Date ? cn.updatedAt.toISOString() : cn.updatedAt,
    };
  }

  async recomputeInvoiceBalance(invoiceId: string, tx?: any) {
    const db = tx || this.prisma;
    const inv = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: { allocations: true, creditNotes: true },
    });
    if (!inv || inv.status === InvoiceStatus.DRAFT || inv.status === InvoiceStatus.VOID) {
      return;
    }

    const paidDec = new Decimal(
      sumMoney((inv.allocations || []).map((a: any) => a.amount)),
    );
    const creditDec = new Decimal(
      sumMoney((inv.creditNotes || []).map((cn: any) => cn.total)),
    );
    const totalDec = new Decimal(String(inv.total));
    const netPayableDec = Decimal.max(new Decimal(0), totalDec.sub(creditDec));

    let nextStatus: InvoiceStatus = InvoiceStatus.ISSUED;
    if (paidDec.gte(netPayableDec) && (paidDec.gt(0) || creditDec.gte(totalDec))) {
      nextStatus = InvoiceStatus.PAID;
    } else if (paidDec.gt(0)) {
      nextStatus = InvoiceStatus.PARTIALLY_PAID;
    }

    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: formatMoney(paidDec),
        status: nextStatus,
      },
    });
  }

  private async resolveDefaultOrExplicitTaxPercent(
    taxRateId: string | null | undefined,
    tx?: any,
  ): Promise<string> {
    const db = tx || this.prisma;
    if (taxRateId) {
      const tr = await db.taxRate.findUnique({ where: { id: taxRateId } });
      if (!tr || !tr.isActive) {
        throw AppException.unprocessable(
          'TAX_RATE_NOT_FOUND',
          `Tax rate ${taxRateId} does not exist or is inactive`,
        );
      }
      return formatPercent(tr.percent);
    }
    const def = await db.taxRate.findFirst({ where: { isDefault: true, isActive: true } });
    return def ? formatPercent(def.percent) : '0.00';
  }

  private async buildReferenceFields(
    params: {
      project?: any | null;
      claimNo?: number | null;
      type: InvoiceType;
      progressReportId?: string | null;
      quotePoRef?: string | null;
      claimReportRef?: string | null;
      hasClaimedVo?: boolean;
      voShortRef?: string | null;
    },
    tx?: any,
  ) {
    const db = tx || this.prisma;
    const projectCodeRef = params.project?.code ?? null;
    const quotePoRef =
      params.quotePoRef ||
      (params.project?.poNumber
        ? `${params.project.contractQuoteRef || ''} / PO ${params.project.poNumber}`.trim()
        : params.project?.contractQuoteRef) ||
      null;

    let prNumber: string | null = null;
    if (params.progressReportId) {
      const pr = await db.progressReport.findUnique({
        where: { id: params.progressReportId },
      });
      prNumber = pr?.number ?? null;
    }

    let claimReportRef = params.claimReportRef ?? null;
    if (!claimReportRef) {
      if (params.type === InvoiceType.PROGRESS_CLAIM && params.claimNo) {
        const pcLabel = `PC-${String(params.claimNo).padStart(2, '0')}`;
        const extras: string[] = [pcLabel];
        if (prNumber) extras.push(prNumber);
        if (params.hasClaimedVo && params.voShortRef) extras.push(params.voShortRef);
        claimReportRef = extras.join(' / ');
      } else if (params.type === InvoiceType.RETENTION_RELEASE) {
        claimReportRef = 'RET';
      } else if (prNumber) {
        claimReportRef = prNumber;
      }
    }

    const refParts = [projectCodeRef, claimReportRef].filter(Boolean);
    const referenceSummary = refParts.length > 0 ? refParts.join(' / ') : null;

    return {
      projectCodeRef,
      quotePoRef,
      claimReportRef,
      referenceSummary,
    };
  }

  async list(
    user: AuthUser,
    query: PaginationQuery & {
      type?: InvoiceType;
      status?: InvoiceStatus;
      clientId?: string;
      projectId?: string;
      from?: string;
      to?: string;
      overdue?: boolean;
    },
  ) {
    let allowedProjectIds: Set<string> | null = null;
    if (user.role === Role.PROJECT_MANAGER) {
      const mems = await this.prisma.projectMember.findMany({ where: { userId: user.id } });
      allowedProjectIds = new Set(mems.map((m: any) => m.projectId));
    }

    const all = await this.prisma.invoice.findMany({
      include: { client: true, project: true },
      orderBy: { createdAt: 'desc' },
    });

    const todayStr = getKlTodayString();
    const filtered = all.filter((inv: any) => {
      if (allowedProjectIds && (!inv.projectId || !allowedProjectIds.has(inv.projectId))) {
        return false;
      }
      if (query.type && inv.type !== query.type) return false;
      if (query.status && inv.status !== query.status) return false;
      if (query.clientId && inv.clientId !== query.clientId) return false;
      if (query.projectId && inv.projectId !== query.projectId) return false;
      const issueStr = formatDateOnly(inv.issueDate);
      if (query.from && (!issueStr || issueStr < query.from)) return false;
      if (query.to && (!issueStr || issueStr > query.to)) return false;
      if (query.overdue) {
        const dueStr = formatDateOnly(inv.dueDate);
        const isPayable =
          inv.status === InvoiceStatus.ISSUED || inv.status === InvoiceStatus.PARTIALLY_PAID;
        if (!isPayable || !dueStr || dueStr >= todayStr) return false;
      }
      if (query.q) {
        const needle = query.q.toLowerCase();
        const mNum = String(inv.number || '').toLowerCase().includes(needle);
        const mRef = String(inv.referenceSummary || '').toLowerCase().includes(needle);
        const mCli = String(inv.client?.name || '').toLowerCase().includes(needle);
        if (!mNum && !mRef && !mCli) return false;
      }
      return true;
    });

    const skip = (query.page - 1) * query.pageSize;
    const paged = filtered.slice(skip, skip + query.pageSize);
    return {
      items: paged.map((i: any) => this.serializeSummary(i)),
      total: filtered.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getById(user: AuthUser, id: string, tx?: any) {
    const db = tx || this.prisma;
    const inv = await db.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        project: true,
        lines: true,
        claimLines: true,
        creditNotes: true,
      },
    });
    if (!inv) {
      throw AppException.notFound('NOT_FOUND', 'Invoice not found');
    }
    if (user.role === Role.PROJECT_MANAGER) {
      if (!inv.projectId) {
        throw AppException.forbidden('FORBIDDEN', 'You do not have access to this invoice');
      }
      await this.projectAccessService.assertMember(user, inv.projectId);
    }
    return this.serializeFull(inv, db);
  }

  // ---------------------------------------------------------------------------
  // Simple Invoices
  // ---------------------------------------------------------------------------

  async createSimpleInvoice(user: AuthUser, dto: SimpleInvoiceCreate) {
    if (dto.type !== InvoiceType.SIMPLE) {
      throw AppException.unprocessable(
        'INVOICE_TYPE_NOT_SUPPORTED',
        'Only SIMPLE invoices can be created on POST /invoices',
      );
    }

    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client || !client.isActive) {
      throw AppException.unprocessable(
        'CLIENT_NOT_FOUND',
        'clientId does not exist or the client is inactive',
      );
    }

    const project = dto.projectId
      ? await this.prisma.project.findUnique({ where: { id: dto.projectId } })
      : null;

    const calcLines = await Promise.all(
      dto.lines.map(async (l, idx) => {
        const taxPctStr = l.taxRateId
          ? await this.resolveDefaultOrExplicitTaxPercent(l.taxRateId)
          : '0.00';
        const qty = toDecimal(l.quantity);
        const rate = roundMoney(l.rate);
        const amount = roundMoney(qty.mul(rate));
        const taxAmt = roundMoney(amount.mul(toDecimal(taxPctStr)).div(100));
        return {
          id: l.id || uuidv7(),
          sortOrder: idx,
          description: l.description.trim(),
          unit: l.unit ?? null,
          quantity: formatQuantity(qty),
          rate: formatMoney(rate),
          amount: formatMoney(amount),
          taxPercent: taxPctStr,
          taxAmount: formatMoney(taxAmt),
          classificationCode: l.classificationCode ?? '022',
        };
      }),
    );

    const subtotal = sumMoney(calcLines.map((l) => l.amount));
    const taxAmount = sumMoney(calcLines.map((l) => l.taxAmount));
    const total = sumMoney([subtotal, taxAmount]);

    const refs = await this.buildReferenceFields({
      project,
      type: InvoiceType.SIMPLE,
      quotePoRef: dto.quotePoRef,
      claimReportRef: dto.claimReportRef,
    });

    return this.prisma.$transaction(async (tx: any) => {
      const id = uuidv7();
      await tx.invoice.create({
        data: {
          id,
          type: InvoiceType.SIMPLE,
          clientId: dto.clientId,
          projectId: dto.projectId ?? null,
          status: InvoiceStatus.DRAFT,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
          ...refs,
          subtotal,
          taxAmount,
          total,
          notes: dto.notes ?? null,
          createdById: user.id,
        },
      });

      for (const l of calcLines) {
        await tx.invoiceLine.create({
          data: {
            ...l,
            invoiceId: id,
          },
        });
      }

      const full = await this.getById(user, id, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Invoice',
          entityId: id,
          action: 'CREATE_SIMPLE',
          after: full,
        },
        tx,
      );
      return full;
    });
  }

  // ---------------------------------------------------------------------------
  // Progress Claims
  // ---------------------------------------------------------------------------

  private async getPreviousIssuedClaimState(projectId: string, tx?: any) {
    const db = tx || this.prisma;
    const issuedClaims = await db.invoice.findMany({
      where: {
        projectId,
        type: InvoiceType.PROGRESS_CLAIM,
        status: {
          in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID],
        },
      },
      include: { claimLines: true },
      orderBy: { claimNo: 'desc' },
    });

    const prev = issuedClaims[0];
    if (!prev) {
      return { previousClaimNo: 0, state: null };
    }

    const grossDec = new Decimal(String(prev.grossToDate ?? 0));
    const retDec = new Decimal(String(prev.retentionToDate ?? 0));
    const netToDate = formatMoney(grossDec.sub(retDec));

    const lineByContractItemId: Record<
      string,
      { cumulativePercent: string; cumulativeAmount: string }
    > = {};
    for (const cl of prev.claimLines || []) {
      lineByContractItemId[cl.contractItemId] = {
        cumulativePercent: formatPercent(cl.cumulativePercent),
        cumulativeAmount: formatMoney(cl.cumulativeAmount),
      };
    }

    return {
      previousClaimNo: Number(prev.claimNo || 0),
      state: {
        previousNetCertified: netToDate,
        lineByContractItemId,
      },
    };
  }

  async createProgressClaim(user: AuthUser, projectId: string, dto: ProgressClaimCreate) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw AppException.notFound('NOT_FOUND', 'Project not found');
    }
    await this.projectAccessService.assertMember(user, projectId);

    const contractItems = await this.prisma.contractItem.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    });
    if (contractItems.length === 0) {
      throw AppException.conflict('CONTRACT_NOT_FOUND', 'The project has no contract yet');
    }

    // AC5: Only one DRAFT progress claim per project at a time
    const existingDraft = await this.prisma.invoice.findFirst({
      where: {
        projectId,
        type: InvoiceType.PROGRESS_CLAIM,
        status: InvoiceStatus.DRAFT,
      },
    });
    if (existingDraft) {
      throw AppException.conflict(
        'DRAFT_CLAIM_EXISTS',
        'The project already has a DRAFT progress claim',
        { invoiceId: existingDraft.id },
      );
    }

    const { previousClaimNo, state: previousClaimState } =
      await this.getPreviousIssuedClaimState(projectId);
    const nextClaimNo = previousClaimNo + 1;

    const taxPercent = await this.resolveDefaultOrExplicitTaxPercent(dto?.taxRateId);

    // If progressReportId (PR-P26014-001) is supplied, pre-fill claim lines from that report!
    let initialInputs: Array<{ contractItemId: string; cumulativePercent: string }> = [];
    if (dto?.progressReportId) {
      const pr = await this.prisma.progressReport.findUnique({
        where: { id: dto.progressReportId },
        include: { lines: true },
      });
      if (pr && pr.projectId === projectId) {
        if (pr.lines && pr.lines.length > 0) {
          initialInputs = pr.lines.map((l: any) => ({
            contractItemId: l.contractItemId,
            cumulativePercent: formatPercent(l.cumulativePercent),
          }));
        } else if (Number(pr.overallPercent) > 0) {
          initialInputs = contractItems.map((ci: any) => ({
            contractItemId: ci.id,
            cumulativePercent: formatPercent(pr.overallPercent),
          }));
        }
      }
    }

    let calculated;
    try {
      calculated = ClaimCalculator.calculate({
        contractItems,
        previousClaim: previousClaimState,
        inputs: initialInputs,
        retentionPercent: project.retentionPercent,
        retentionCapPercent: project.retentionCapPercent,
        taxPercent,
      });
    } catch (err) {
      if (err instanceof ClaimCalculationError) {
        throw AppException.unprocessable(err.code, err.message);
      }
      throw err;
    }

    const refs = await this.buildReferenceFields({
      project,
      claimNo: nextClaimNo,
      type: InvoiceType.PROGRESS_CLAIM,
      progressReportId: dto?.progressReportId ?? null,
      quotePoRef: dto?.quotePoRef,
      claimReportRef: dto?.claimReportRef,
    });

    return this.prisma.$transaction(async (tx: any) => {
      const id = uuidv7();
      await tx.invoice.create({
        data: {
          id,
          type: InvoiceType.PROGRESS_CLAIM,
          projectId,
          clientId: project.clientId,
          status: InvoiceStatus.DRAFT,
          claimNo: nextClaimNo,
          progressReportId: dto?.progressReportId ?? null,
          ...refs,
          issueDate: dto?.issueDate ? new Date(dto.issueDate) : null,
          periodFrom: dto?.periodFrom ? new Date(dto.periodFrom) : null,
          periodTo: dto?.periodTo ? new Date(dto.periodTo) : null,
          grossToDate: calculated.grossToDate,
          retentionToDate: calculated.retentionToDate,
          previousNetCertified: calculated.previousNetCertified,
          taxPercent: calculated.taxPercent,
          subtotal: calculated.subtotal,
          taxAmount: calculated.taxAmount,
          total: calculated.total,
          notes: dto?.notes ?? null,
          createdById: user.id,
        },
      });

      for (const cl of calculated.claimLines) {
        await tx.claimLine.create({
          data: {
            id: uuidv7(),
            invoiceId: id,
            contractItemId: cl.contractItemId,
            cumulativePercent: cl.cumulativePercent,
            cumulativeQuantity: cl.cumulativeQuantity,
            cumulativeAmount: cl.cumulativeAmount,
            previousAmount: cl.previousAmount,
            thisClaimAmount: cl.thisClaimAmount,
          },
        });
      }

      const full = await this.getById(user, id, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Invoice',
          entityId: id,
          action: 'CREATE_PROGRESS_CLAIM',
          after: full,
        },
        tx,
      );
      return full;
    });
  }

  // ---------------------------------------------------------------------------
  // Retention Releases
  // ---------------------------------------------------------------------------

  private async getRetentionHeldAndReleased(
    projectId: string,
    excludeInvoiceId?: string,
    tx?: any,
  ): Promise<{ totalHeld: Decimal; alreadyReleasedOrDraft: Decimal }> {
    const db = tx || this.prisma;
    const issuedClaims = await db.invoice.findMany({
      where: {
        projectId,
        type: InvoiceType.PROGRESS_CLAIM,
        status: {
          in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID],
        },
      },
      orderBy: { claimNo: 'desc' },
    });
    const latestClaim = issuedClaims[0];
    const totalHeld = latestClaim
      ? new Decimal(String(latestClaim.retentionToDate ?? 0))
      : new Decimal(0);

    const releases = await db.invoice.findMany({
      where: {
        projectId,
        type: InvoiceType.RETENTION_RELEASE,
        status: {
          in: [
            InvoiceStatus.DRAFT,
            InvoiceStatus.ISSUED,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.PAID,
          ],
        },
      },
    });

    const filteredReleases = excludeInvoiceId
      ? releases.filter((r: any) => r.id !== excludeInvoiceId)
      : releases;

    const alreadyReleasedOrDraft = new Decimal(
      sumMoney(filteredReleases.map((r: any) => r.subtotal)),
    );

    return { totalHeld, alreadyReleasedOrDraft };
  }

  async createRetentionRelease(
    user: AuthUser,
    projectId: string,
    dto: RetentionReleaseCreate,
  ) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw AppException.notFound('NOT_FOUND', 'Project not found');
    }
    const contractCount = await this.prisma.contractItem.count({ where: { projectId } });
    if (contractCount === 0) {
      throw AppException.conflict('CONTRACT_NOT_FOUND', 'The project has no contract yet');
    }

    const { totalHeld, alreadyReleasedOrDraft } =
      await this.getRetentionHeldAndReleased(projectId);
    const amountDec = roundMoney(dto.amount);
    if (alreadyReleasedOrDraft.add(amountDec).gt(totalHeld)) {
      throw AppException.unprocessable(
        'RETENTION_RELEASE_EXCEEDS_HELD',
        'Total retention released would exceed retention held on this project',
      );
    }

    const taxPercent = await this.resolveDefaultOrExplicitTaxPercent(dto.taxRateId);
    const taxAmount = formatMoney(roundMoney(amountDec.mul(toDecimal(taxPercent)).div(100)));
    const subtotal = formatMoney(amountDec);
    const total = sumMoney([subtotal, taxAmount]);

    const refs = await this.buildReferenceFields({
      project,
      type: InvoiceType.RETENTION_RELEASE,
    });

    return this.prisma.$transaction(async (tx: any) => {
      const id = uuidv7();
      await tx.invoice.create({
        data: {
          id,
          type: InvoiceType.RETENTION_RELEASE,
          projectId,
          clientId: project.clientId,
          status: InvoiceStatus.DRAFT,
          ...refs,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
          taxPercent,
          subtotal,
          taxAmount,
          total,
          notes: dto.notes ?? null,
          createdById: user.id,
        },
      });

      await tx.invoiceLine.create({
        data: {
          id: uuidv7(),
          invoiceId: id,
          sortOrder: 0,
          description: `Retention release for ${project.code} ${project.name}`,
          unit: 'LS',
          quantity: '1.000',
          rate: subtotal,
          amount: subtotal,
          taxPercent,
          taxAmount,
          classificationCode: '022',
        },
      });

      const full = await this.getById(user, id, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Invoice',
          entityId: id,
          action: 'CREATE_RETENTION_RELEASE',
          after: full,
        },
        tx,
      );
      return full;
    });
  }

  // ---------------------------------------------------------------------------
  // Replace / Delete / Issue / Void / PDF
  // ---------------------------------------------------------------------------

  async replace(user: AuthUser, id: string, body: any) {
    const existing = await this.prisma.invoice.findUnique({ where: { id } });
    if (!existing) {
      throw AppException.notFound('NOT_FOUND', 'Invoice not found');
    }
    if (existing.status !== InvoiceStatus.DRAFT) {
      throw AppException.conflict('INVOICE_NOT_EDITABLE', 'Only DRAFT invoices can be edited');
    }

    if (user.role === Role.PROJECT_MANAGER) {
      if (existing.type !== InvoiceType.PROGRESS_CLAIM || !existing.projectId) {
        throw AppException.forbidden(
          'FORBIDDEN',
          'PROJECT_MANAGER may only edit DRAFT progress claims on own projects',
        );
      }
      await this.projectAccessService.assertMember(user, existing.projectId);
    }

    if (existing.type === InvoiceType.SIMPLE) {
      if (!Array.isArray(body?.lines)) {
        throw AppException.unprocessable(
          'INVOICE_BODY_TYPE_MISMATCH',
          'A SIMPLE invoice update requires lines',
        );
      }
      const dto = body as SimpleInvoiceUpdate;
      const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
      if (!client || !client.isActive) {
        throw AppException.unprocessable(
          'CLIENT_NOT_FOUND',
          'clientId does not exist or the client is inactive',
        );
      }
      const project = dto.projectId
        ? await this.prisma.project.findUnique({ where: { id: dto.projectId } })
        : null;

      const calcLines = await Promise.all(
        dto.lines.map(async (l, idx) => {
          const taxPctStr = l.taxRateId
            ? await this.resolveDefaultOrExplicitTaxPercent(l.taxRateId)
            : '0.00';
          const qty = toDecimal(l.quantity);
          const rate = roundMoney(l.rate);
          const amount = roundMoney(qty.mul(rate));
          const taxAmt = roundMoney(amount.mul(toDecimal(taxPctStr)).div(100));
          return {
            id: l.id || uuidv7(),
            sortOrder: idx,
            description: l.description.trim(),
            unit: l.unit ?? null,
            quantity: formatQuantity(qty),
            rate: formatMoney(rate),
            amount: formatMoney(amount),
            taxPercent: taxPctStr,
            taxAmount: formatMoney(taxAmt),
            classificationCode: l.classificationCode ?? '022',
          };
        }),
      );

      const subtotal = sumMoney(calcLines.map((l) => l.amount));
      const taxAmount = sumMoney(calcLines.map((l) => l.taxAmount));
      const total = sumMoney([subtotal, taxAmount]);
      const refs = await this.buildReferenceFields({
        project,
        type: InvoiceType.SIMPLE,
        quotePoRef: dto.quotePoRef ?? existing.quotePoRef,
        claimReportRef: dto.claimReportRef ?? existing.claimReportRef,
      });

      return this.prisma.$transaction(async (tx: any) => {
        await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
        await tx.invoice.update({
          where: { id },
          data: {
            clientId: dto.clientId,
            projectId: dto.projectId ?? null,
            issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
            ...refs,
            subtotal,
            taxAmount,
            total,
            notes: dto.notes ?? null,
          },
        });
        for (const l of calcLines) {
          await tx.invoiceLine.create({
            data: { ...l, invoiceId: id },
          });
        }
        return this.getById(user, id, tx);
      });
    }

    if (existing.type === InvoiceType.PROGRESS_CLAIM) {
      if (!Array.isArray(body?.claimLines)) {
        throw AppException.unprocessable(
          'INVOICE_BODY_TYPE_MISMATCH',
          'A PROGRESS_CLAIM invoice update requires claimLines',
        );
      }
      const dto = body as ProgressClaimUpdate;
      const project = await this.prisma.project.findUnique({
        where: { id: existing.projectId! },
      });
      const contractItems = await this.prisma.contractItem.findMany({
        where: { projectId: existing.projectId! },
        orderBy: { sortOrder: 'asc' },
      });
      const { state: previousClaimState } = await this.getPreviousIssuedClaimState(
        existing.projectId!,
      );
      const taxPercent =
        dto.taxRateId !== undefined
          ? await this.resolveDefaultOrExplicitTaxPercent(dto.taxRateId)
          : formatPercent(existing.taxPercent ?? 0);

      let calculated;
      try {
        calculated = ClaimCalculator.calculate({
          contractItems,
          previousClaim: previousClaimState,
          inputs: dto.claimLines,
          retentionPercent: project!.retentionPercent,
          retentionCapPercent: project!.retentionCapPercent,
          taxPercent,
        });
      } catch (err) {
        if (err instanceof ClaimCalculationError) {
          throw AppException.unprocessable(err.code, err.message);
        }
        throw err;
      }

      // Check if any claimed line in this claim belongs to a Variation Order
      let hasClaimedVo = false;
      let voShortRef: string | null = null;
      for (const cl of calculated.claimLines) {
        if (Number(cl.thisClaimAmount) !== 0) {
          const ci = contractItems.find((c: any) => c.id === cl.contractItemId);
          if (ci?.variationOrderId) {
            hasClaimedVo = true;
            const vo = await this.prisma.variationOrder.findUnique({
              where: { id: ci.variationOrderId },
            });
            voShortRef = vo?.shortRef || vo?.number || 'VO-01';
          }
        }
      }

      const refs = await this.buildReferenceFields({
        project,
        claimNo: existing.claimNo,
        type: InvoiceType.PROGRESS_CLAIM,
        progressReportId:
          dto.progressReportId !== undefined ? dto.progressReportId : existing.progressReportId,
        quotePoRef: dto.quotePoRef ?? existing.quotePoRef,
        claimReportRef: dto.claimReportRef,
        hasClaimedVo,
        voShortRef,
      });

      return this.prisma.$transaction(async (tx: any) => {
        await tx.claimLine.deleteMany({ where: { invoiceId: id } });
        await tx.invoice.update({
          where: { id },
          data: {
            ...(dto.issueDate !== undefined
              ? { issueDate: dto.issueDate ? new Date(dto.issueDate) : null }
              : {}),
            ...(dto.periodFrom !== undefined
              ? { periodFrom: dto.periodFrom ? new Date(dto.periodFrom) : null }
              : {}),
            ...(dto.periodTo !== undefined
              ? { periodTo: dto.periodTo ? new Date(dto.periodTo) : null }
              : {}),
            ...(dto.progressReportId !== undefined
              ? { progressReportId: dto.progressReportId }
              : {}),
            ...refs,
            grossToDate: calculated.grossToDate,
            retentionToDate: calculated.retentionToDate,
            previousNetCertified: calculated.previousNetCertified,
            taxPercent: calculated.taxPercent,
            subtotal: calculated.subtotal,
            taxAmount: calculated.taxAmount,
            total: calculated.total,
            ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          },
        });

        for (const cl of calculated.claimLines) {
          await tx.claimLine.create({
            data: {
              id: uuidv7(),
              invoiceId: id,
              contractItemId: cl.contractItemId,
              cumulativePercent: cl.cumulativePercent,
              cumulativeQuantity: cl.cumulativeQuantity,
              cumulativeAmount: cl.cumulativeAmount,
              previousAmount: cl.previousAmount,
              thisClaimAmount: cl.thisClaimAmount,
            },
          });
        }
        return this.getById(user, id, tx);
      });
    }

    // RETENTION_RELEASE
    if (typeof body?.amount !== 'string') {
      throw AppException.unprocessable(
        'INVOICE_BODY_TYPE_MISMATCH',
        'A RETENTION_RELEASE invoice update requires amount',
      );
    }
    const dto = body as RetentionReleaseUpdate;
    const { totalHeld, alreadyReleasedOrDraft } = await this.getRetentionHeldAndReleased(
      existing.projectId!,
      id,
    );
    const amountDec = roundMoney(dto.amount);
    if (alreadyReleasedOrDraft.add(amountDec).gt(totalHeld)) {
      throw AppException.unprocessable(
        'RETENTION_RELEASE_EXCEEDS_HELD',
        'Total retention released would exceed retention held on this project',
      );
    }

    const taxPercent =
      dto.taxRateId !== undefined
        ? await this.resolveDefaultOrExplicitTaxPercent(dto.taxRateId)
        : formatPercent(existing.taxPercent ?? 0);
    const subtotal = formatMoney(amountDec);
    const taxAmount = formatMoney(roundMoney(amountDec.mul(toDecimal(taxPercent)).div(100)));
    const total = sumMoney([subtotal, taxAmount]);

    return this.prisma.$transaction(async (tx: any) => {
      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.update({
        where: { id },
        data: {
          ...(dto.issueDate !== undefined
            ? { issueDate: dto.issueDate ? new Date(dto.issueDate) : null }
            : {}),
          taxPercent,
          subtotal,
          taxAmount,
          total,
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      });
      await tx.invoiceLine.create({
        data: {
          id: uuidv7(),
          invoiceId: id,
          sortOrder: 0,
          description: 'Retention release',
          unit: 'LS',
          quantity: '1.000',
          rate: subtotal,
          amount: subtotal,
          taxPercent,
          taxAmount,
          classificationCode: '022',
        },
      });
      return this.getById(user, id, tx);
    });
  }

  async delete(user: AuthUser, id: string) {
    const existing = await this.prisma.invoice.findUnique({ where: { id } });
    if (!existing) {
      throw AppException.notFound('NOT_FOUND', 'Invoice not found');
    }
    if (existing.status !== InvoiceStatus.DRAFT) {
      throw AppException.conflict('INVOICE_NOT_EDITABLE', 'Only DRAFT invoices can be deleted');
    }

    await this.prisma.$transaction(async (tx: any) => {
      await tx.invoice.delete({ where: { id } });
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Invoice',
          entityId: id,
          action: 'DELETE',
          before: { id, type: existing.type },
        },
        tx,
      );
    });
  }

  async issue(user: AuthUser, id: string) {
    const inv = await this.getById(user, id);
    if (inv.status !== InvoiceStatus.DRAFT) {
      throw AppException.conflict('INVOICE_INVALID_STATUS', 'The invoice is not DRAFT');
    }
    if (inv.type === InvoiceType.SIMPLE && (!inv.lines || inv.lines.length === 0)) {
      throw AppException.unprocessable(
        'INVOICE_HAS_NO_LINES',
        'A simple invoice with no lines cannot be issued',
      );
    }
    if (new Decimal(inv.total).lte(0)) {
      throw AppException.unprocessable(
        'INVOICE_TOTAL_NOT_POSITIVE',
        'The invoice total must be positive to be issued',
      );
    }

    if (inv.type === InvoiceType.RETENTION_RELEASE && inv.projectId) {
      const { totalHeld, alreadyReleasedOrDraft } = await this.getRetentionHeldAndReleased(
        inv.projectId,
        id,
      );
      if (alreadyReleasedOrDraft.add(new Decimal(inv.subtotal)).gt(totalHeld)) {
        throw AppException.unprocessable(
          'RETENTION_RELEASE_EXCEEDS_HELD',
          'Total retention released would exceed retention held',
        );
      }
    }

    const client = await this.prisma.client.findUnique({ where: { id: inv.clientId } });
    const project = inv.projectId
      ? await this.prisma.project.findUnique({ where: { id: inv.projectId } })
      : null;
    const company = await this.companyService.getCompanyById(project?.companyId);

    const issueDateYmd = inv.issueDate || getKlTodayString();
    const dueDateYmd = addDaysToYmd(issueDateYmd, company.defaultPaymentTermDays);
    const issueYear = new Date(`${issueDateYmd}T00:00:00.000Z`).getUTCFullYear();

    return this.prisma.$transaction(async (tx: any) => {
      // Unbroken tax invoice sequence (INV-26-0001) across all invoice types!
      const rawSeq = await this.sequenceService.next('INV', tx, issueYear);
      const number = formatTaxInvoiceNumber(rawSeq);

      await tx.invoice.update({
        where: { id },
        data: {
          number,
          status: InvoiceStatus.ISSUED,
          issueDate: new Date(`${issueDateYmd}T00:00:00.000Z`),
          dueDate: new Date(`${dueDateYmd}T00:00:00.000Z`),
          buyerName: client?.name ?? null,
          buyerRegistrationNo: client?.registrationNo ?? null,
          buyerTin: client?.tin ?? null,
          buyerSstNo: client?.sstNo ?? null,
          buyerAddress: client?.address ?? null,
          supplierName: company.name,
          supplierRegistrationNo: company.registrationNo,
          supplierTin: company.tin,
          supplierSstNo: company.sstNo,
          supplierMsicCode: company.msicCode,
          supplierAddress: company.address,
        },
      });

      const issuedFull = await this.getById(user, id, tx);
      const html = this.pdfService.renderInvoiceHtml({
        company,
        client,
        project,
        invoice: issuedFull,
      });
      const pdfBuffer = await this.pdfService.renderHtmlToPdf(
        `Invoice ${number}`,
        html,
      );
      const pdfFile = await this.filesService.storeBuffer(
        pdfBuffer,
        {
          fileName: `${number}.pdf`,
          mimeType: 'application/pdf',
          purpose: 'DOCUMENT_PDF',
          uploadedById: user.id,
        },
        tx,
      );

      await tx.invoice.update({
        where: { id },
        data: { pdfFileId: pdfFile.id },
      });

      const finalFull = await this.getById(user, id, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Invoice',
          entityId: id,
          action: 'ISSUE',
          after: finalFull,
        },
        tx,
      );
      return finalFull;
    });
  }

  async voidInvoice(user: AuthUser, id: string, dto: InvoiceVoidRequest) {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      include: { allocations: true },
    });
    if (!existing) {
      throw AppException.notFound('NOT_FOUND', 'Invoice not found');
    }
    if (existing.status !== InvoiceStatus.ISSUED) {
      throw AppException.conflict('INVOICE_INVALID_STATUS', 'The invoice is not ISSUED');
    }
    if (existing.allocations && existing.allocations.length > 0) {
      throw AppException.conflict(
        'INVOICE_HAS_PAYMENTS',
        'The invoice has payment allocations and cannot be voided',
      );
    }

    if (
      existing.type === InvoiceType.PROGRESS_CLAIM &&
      existing.projectId &&
      existing.claimNo !== null
    ) {
      const laterClaims = await this.prisma.invoice.count({
        where: {
          projectId: existing.projectId,
          type: InvoiceType.PROGRESS_CLAIM,
          status: { not: InvoiceStatus.VOID },
          claimNo: { gt: existing.claimNo },
        },
      });
      if (laterClaims > 0) {
        throw AppException.conflict(
          'INVOICE_HAS_DEPENDENT_CLAIM',
          'A later progress claim on the project depends on this claim',
        );
      }
    }

    return this.prisma.$transaction(async (tx: any) => {
      await tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.VOID,
          voidedAt: new Date(),
          voidReason: dto.reason.trim(),
          claimNo: null, // Release claimNo slot so next progress claim reuses it cleanly
        },
      });
      const updated = await this.getById(user, id, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Invoice',
          entityId: id,
          action: 'VOID',
          after: updated,
        },
        tx,
      );
      return updated;
    });
  }

  async getPdfUrl(user: AuthUser, id: string) {
    const inv = await this.getById(user, id);
    if (inv.status !== InvoiceStatus.DRAFT && inv.pdfFileId) {
      return this.filesService.getDownloadUrl(inv.pdfFileId);
    }

    const client = await this.prisma.client.findUnique({ where: { id: inv.clientId } });
    const project = inv.projectId
      ? await this.prisma.project.findUnique({ where: { id: inv.projectId } })
      : null;
    const company = await this.companyService.getCompanyById(project?.companyId);

    const html = this.pdfService.renderInvoiceHtml({
      company,
      client,
      project,
      invoice: inv,
      watermark: inv.status === InvoiceStatus.DRAFT ? 'DRAFT' : undefined,
    });
    const pdfBuffer = await this.pdfService.renderHtmlToPdf(
      `Invoice Preview ${inv.number || inv.id}`,
      html,
    );
    const previewFile = await this.filesService.storeBuffer(pdfBuffer, {
      fileName: `invoice-${inv.id}-preview.pdf`,
      mimeType: 'application/pdf',
      purpose: 'DOCUMENT_PDF',
      uploadedById: user.id,
    });
    return this.filesService.getDownloadUrl(previewFile.id);
  }

  // ---------------------------------------------------------------------------
  // Credit Notes
  // ---------------------------------------------------------------------------

  async createCreditNote(user: AuthUser, invoiceId: string, dto: CreditNoteCreate) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { creditNotes: true, allocations: true },
    });
    if (!inv) {
      throw AppException.notFound('NOT_FOUND', 'Invoice not found');
    }
    if (inv.status === InvoiceStatus.DRAFT || inv.status === InvoiceStatus.VOID) {
      throw AppException.conflict(
        'INVOICE_INVALID_STATUS',
        'Cannot issue a credit note against a DRAFT or VOID invoice',
      );
    }

    const taxPctStr = dto.taxRateId
      ? await this.resolveDefaultOrExplicitTaxPercent(dto.taxRateId)
      : '0.00';
    const subtotalDec = roundMoney(dto.subtotal);
    const taxAmountDec = roundMoney(subtotalDec.mul(toDecimal(taxPctStr)).div(100));
    const totalDec = subtotalDec.add(taxAmountDec);

    const existingCredits = new Decimal(
      sumMoney((inv.creditNotes || []).map((cn: any) => cn.total)),
    );
    const existingPaid = new Decimal(
      sumMoney((inv.allocations || []).map((a: any) => a.amount)),
    );
    const invoiceTotal = new Decimal(String(inv.total));

    if (existingCredits.add(totalDec).add(existingPaid).gt(invoiceTotal)) {
      throw AppException.unprocessable(
        'CREDIT_NOTE_EXCEEDS_INVOICE',
        'Credit notes plus payment allocations would exceed the invoice total',
      );
    }

    const issueDateYmd = dto.issueDate || getKlTodayString();
    const issueYear = new Date(`${issueDateYmd}T00:00:00.000Z`).getUTCFullYear();

    return this.prisma.$transaction(async (tx: any) => {
      const rawSeq = await this.sequenceService.next('CN', tx, issueYear);
      const number = formatTaxInvoiceNumber(rawSeq);

      const cn = await tx.creditNote.create({
        data: {
          id: uuidv7(),
          number,
          invoiceId,
          issueDate: new Date(`${issueDateYmd}T00:00:00.000Z`),
          reason: dto.reason.trim(),
          subtotal: formatMoney(subtotalDec),
          taxAmount: formatMoney(taxAmountDec),
          total: formatMoney(totalDec),
          createdById: user.id,
        },
      });

      await this.recomputeInvoiceBalance(invoiceId, tx);

      const serialized = this.serializeCreditNote(cn);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'CreditNote',
          entityId: cn.id,
          action: 'CREATE',
          after: serialized,
        },
        tx,
      );
      return serialized;
    });
  }

  // ---------------------------------------------------------------------------
  // Payments
  // ---------------------------------------------------------------------------

  serializePayment(p: any) {
    const allocs = (p.allocations || []).map((a: any) => ({
      id: a.id,
      paymentId: a.paymentId,
      invoiceId: a.invoiceId,
      invoiceNumber: a.invoice?.number ?? '',
      amount: formatMoney(a.amount),
    }));
    const allocatedSum = new Decimal(sumMoney(allocs.map((a: any) => a.amount)));
    const amountDec = new Decimal(String(p.amount));
    const unallocatedAmount = formatMoney(Decimal.max(new Decimal(0), amountDec.sub(allocatedSum)));

    return {
      id: p.id,
      clientId: p.clientId,
      ...(p.client ? { client: { id: p.client.id, name: p.client.name } } : {}),
      receivedDate: formatDateOnly(p.receivedDate),
      method: p.method,
      reference: p.reference ?? null,
      amount: formatMoney(p.amount),
      notes: p.notes ?? null,
      allocations: allocs,
      unallocatedAmount,
      createdById: p.createdById,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
      updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
    };
  }

  async listPayments(
    query: PaginationQuery & {
      clientId?: string;
      invoiceId?: string;
      from?: string;
      to?: string;
    },
  ) {
    const all = await this.prisma.payment.findMany({
      include: { client: true, allocations: true },
      orderBy: { receivedDate: 'desc' },
    });

    const filtered = all.filter((p: any) => {
      if (query.clientId && p.clientId !== query.clientId) return false;
      if (query.invoiceId) {
        const hasAlloc = (p.allocations || []).some((a: any) => a.invoiceId === query.invoiceId);
        if (!hasAlloc) return false;
      }
      const rDate = formatDateOnly(p.receivedDate);
      if (query.from && (!rDate || rDate < query.from)) return false;
      if (query.to && (!rDate || rDate > query.to)) return false;
      if (query.q) {
        const needle = query.q.toLowerCase();
        if (
          !String(p.reference || '').toLowerCase().includes(needle) &&
          !String(p.client?.name || '').toLowerCase().includes(needle)
        ) {
          return false;
        }
      }
      return true;
    });

    const skip = (query.page - 1) * query.pageSize;
    const paged = filtered.slice(skip, skip + query.pageSize);
    return {
      items: paged.map((p: any) => this.serializePayment(p)),
      total: filtered.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async createPayment(user: AuthUser, dto: PaymentCreate) {
    const paymentAmtDec = roundMoney(dto.amount);
    const totalAllocDec = new Decimal(
      sumMoney(dto.allocations.map((a) => a.amount)),
    );
    if (totalAllocDec.gt(paymentAmtDec)) {
      throw AppException.unprocessable(
        'ALLOCATION_EXCEEDS_PAYMENT',
        'The sum of allocations is greater than the payment amount',
      );
    }

    for (const alloc of dto.allocations) {
      const inv = await this.prisma.invoice.findUnique({
        where: { id: alloc.invoiceId },
        include: { allocations: true, creditNotes: true },
      });
      if (!inv) {
        throw AppException.notFound('NOT_FOUND', `Invoice ${alloc.invoiceId} not found`);
      }
      if (inv.clientId !== dto.clientId) {
        throw AppException.unprocessable(
          'ALLOCATION_CLIENT_MISMATCH',
          'An allocated invoice belongs to another client',
        );
      }
      if (
        inv.status !== InvoiceStatus.ISSUED &&
        inv.status !== InvoiceStatus.PARTIALLY_PAID
      ) {
        throw AppException.conflict(
          'INVOICE_NOT_PAYABLE',
          'An allocated invoice is DRAFT, PAID or VOID',
        );
      }

      const existingPaid = new Decimal(
        sumMoney((inv.allocations || []).map((a: any) => a.amount)),
      );
      const existingCredits = new Decimal(
        sumMoney((inv.creditNotes || []).map((cn: any) => cn.total)),
      );
      const balanceRemaining = new Decimal(String(inv.total))
        .sub(existingCredits)
        .sub(existingPaid);

      if (roundMoney(alloc.amount).gt(balanceRemaining)) {
        throw AppException.unprocessable(
          'ALLOCATION_EXCEEDS_INVOICE_BALANCE',
          'Allocations on an invoice would exceed its remaining balance',
        );
      }
    }

    return this.prisma.$transaction(async (tx: any) => {
      const paymentId = uuidv7();
      await tx.payment.create({
        data: {
          id: paymentId,
          clientId: dto.clientId,
          receivedDate: new Date(`${dto.receivedDate}T00:00:00.000Z`),
          method: dto.method.trim(),
          reference: dto.reference ?? null,
          amount: formatMoney(paymentAmtDec),
          notes: dto.notes ?? null,
          createdById: user.id,
        },
      });

      for (const alloc of dto.allocations) {
        await tx.paymentAllocation.create({
          data: {
            id: uuidv7(),
            paymentId,
            invoiceId: alloc.invoiceId,
            amount: formatMoney(alloc.amount),
          },
        });
        await this.recomputeInvoiceBalance(alloc.invoiceId, tx);
      }

      const full = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { client: true, allocations: true },
      });
      const serialized = this.serializePayment(full);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Payment',
          entityId: paymentId,
          action: 'CREATE',
          after: serialized,
        },
        tx,
      );
      return serialized;
    });
  }

  async deletePayment(user: AuthUser, id: string) {
    const existing = await this.prisma.payment.findUnique({
      where: { id },
      include: { allocations: true },
    });
    if (!existing) {
      throw AppException.notFound('NOT_FOUND', 'Payment not found');
    }

    const invoiceIds = (existing.allocations || []).map((a: any) => a.invoiceId);

    await this.prisma.$transaction(async (tx: any) => {
      await tx.payment.delete({ where: { id } });
      for (const invId of invoiceIds) {
        await this.recomputeInvoiceBalance(invId, tx);
      }
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Payment',
          entityId: id,
          action: 'DELETE',
          before: { id, amount: formatMoney(existing.amount), invoiceIds },
        },
        tx,
      );
    });
  }

  // ---------------------------------------------------------------------------
  // CSV Exports (T11)
  // ---------------------------------------------------------------------------

  async exportInvoicesCsv(from: string, to: string): Promise<string> {
    const all = await this.prisma.invoice.findMany({
      include: { client: true, project: true },
      orderBy: { issueDate: 'asc' },
    });

    const rows = all.filter((inv: any) => {
      if (inv.status === InvoiceStatus.DRAFT) return false;
      const d = formatDateOnly(inv.issueDate);
      return d && d >= from && d <= to;
    });

    const header =
      'InvoiceNumber,Type,Status,IssueDate,DueDate,Client,ProjectCode,QuotePoRef,ClaimReportRef,Subtotal,TaxAmount,Total,AmountPaid';
    const lines = rows.map((inv: any) =>
      [
        inv.number || '',
        inv.type,
        inv.status,
        formatDateOnly(inv.issueDate) || '',
        formatDateOnly(inv.dueDate) || '',
        `"${String(inv.client?.name || '').replace(/"/g, '""')}"`,
        inv.projectCodeRef || inv.project?.code || '',
        `"${String(inv.quotePoRef || '').replace(/"/g, '""')}"`,
        `"${String(inv.claimReportRef || '').replace(/"/g, '""')}"`,
        formatMoney(inv.subtotal),
        formatMoney(inv.taxAmount),
        formatMoney(inv.total),
        formatMoney(inv.amountPaid),
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }

  async exportPaymentsCsv(from: string, to: string): Promise<string> {
    const all = await this.prisma.payment.findMany({
      include: { client: true, allocations: true },
      orderBy: { receivedDate: 'asc' },
    });

    const rows = all.filter((p: any) => {
      const d = formatDateOnly(p.receivedDate);
      return d && d >= from && d <= to;
    });

    const header =
      'PaymentId,ReceivedDate,Client,Method,Reference,PaymentAmount,AllocatedInvoiceNumber,AllocatedAmount';
    const lines: string[] = [];
    for (const p of rows) {
      if (!p.allocations || p.allocations.length === 0) {
        lines.push(
          [
            p.id,
            formatDateOnly(p.receivedDate) || '',
            `"${String(p.client?.name || '').replace(/"/g, '""')}"`,
            p.method,
            `"${String(p.reference || '').replace(/"/g, '""')}"`,
            formatMoney(p.amount),
            '',
            '0.00',
          ].join(','),
        );
      } else {
        for (const a of p.allocations) {
          lines.push(
            [
              p.id,
              formatDateOnly(p.receivedDate) || '',
              `"${String(p.client?.name || '').replace(/"/g, '""')}"`,
              p.method,
              `"${String(p.reference || '').replace(/"/g, '""')}"`,
              formatMoney(p.amount),
              (a as any).invoice?.number || a.invoiceId,
              formatMoney(a.amount),
            ].join(','),
          );
        }
      }
    }
    return [header, ...lines].join('\n');
  }
}
