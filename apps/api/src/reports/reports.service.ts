import { Injectable } from '@nestjs/common';
import {
  ExpenseCategory,
  ExpenseStatus,
  InvoiceStatus,
  InvoiceType,
  ProjectStatus,
  QuotationStatus,
  Role,
  VariationStatus,
  formatMoney,
  formatPercent,
  roundMoney,
  sumMoney,
  toDecimal,
} from '@construction/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../common/project-access.service';
import { FilesService } from '../files/files.service';
import { AuthUser } from '../common/decorators';
import { AppException } from '../common/errors';
import { XlsxSheet, buildXlsxBuffer } from './xlsx-builder';

function formatDateOnly(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val.slice(0, 10);
  return val.toISOString().slice(0, 10);
}

function todayKualaLumpur(): string {
  const now = new Date();
  const klMs = now.getTime() + 8 * 60 * 60 * 1000;
  return new Date(klMs).toISOString().slice(0, 10);
}

const BILLED_INVOICE_STATUSES = new Set<string>([
  InvoiceStatus.ISSUED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.PAID,
]);

const OUTSTANDING_INVOICE_STATUSES = new Set<string>([
  InvoiceStatus.ISSUED,
  InvoiceStatus.PARTIALLY_PAID,
]);

function isWorkingDay(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay(); // 0 = Sunday, 1..6 = Monday..Saturday
  return day >= 1 && day <= 6;
}

function addDays(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function addMonths(dateStr: string, deltaMonths: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + deltaMonths, d));
  return dt.toISOString().slice(0, 10);
}

function diffDays(laterDateStr: string, earlierDateStr: string): number {
  const [y1, m1, d1] = laterDateStr.split('-').map(Number);
  const [y2, m2, d2] = earlierDateStr.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t1 - t2) / (24 * 60 * 60 * 1000));
}

function listWorkingDaysInRange(fromStr: string, toStr: string): string[] {
  if (!fromStr || !toStr || fromStr > toStr) return [];
  const days: string[] = [];
  let cur = fromStr;
  // Guard against unbounded loops (cap at 5000 days ~13.7 years)
  let count = 0;
  while (cur <= toStr && count < 5000) {
    if (isWorkingDay(cur)) {
      days.push(cur);
    }
    cur = addDays(cur, 1);
    count++;
  }
  return days;
}

function listMonthsInRange(fromMonth: string, toMonth: string): string[] {
  if (!fromMonth || !toMonth || fromMonth > toMonth) return [];
  const [y1, m1] = fromMonth.split('-').map(Number);
  const [y2, m2] = toMonth.split('-').map(Number);
  const months: string[] = [];
  let y = y1;
  let m = m1;
  let guard = 0;
  while ((y < y2 || (y === y2 && m <= m2)) && guard < 240) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    guard++;
  }
  return months;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccessService: ProjectAccessService,
    private readonly filesService: FilesService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. Dashboard (/reports/dashboard)
  // ---------------------------------------------------------------------------

  async getDashboard(asOfOverride?: string) {
    const today = asOfOverride || todayKualaLumpur();
    const currentMonth = today.slice(0, 7);
    const yesterday = addDays(today, -1);

    const [projects, quotations, invoices, creditNotes, payments, dailyReports, expenses] =
      await Promise.all([
        this.prisma.project.findMany(),
        this.prisma.quotation.findMany(),
        this.prisma.invoice.findMany({ include: { creditNotes: true } }),
        this.prisma.creditNote.findMany({ include: { invoice: true } }),
        this.prisma.payment.findMany(),
        this.prisma.dailyReport.findMany(),
        this.prisma.expense.findMany(),
      ]);

    const activeProjectList = projects.filter((p: any) => p.status === ProjectStatus.ACTIVE);
    const activeProjects = activeProjectList.length;

    // Latest revision per quotation rootId
    const latestByRoot = new Map<string, any>();
    for (const q of quotations) {
      const prev = latestByRoot.get(q.rootId);
      if (!prev || q.revisionNo > prev.revisionNo) {
        latestByRoot.set(q.rootId, q);
      }
    }

    const awaitingQuotes: any[] = [];
    for (const q of latestByRoot.values()) {
      const validUntilStr = formatDateOnly(q.validUntil);
      const isExpired = q.status === QuotationStatus.SENT && validUntilStr && validUntilStr < today;
      if (q.status === QuotationStatus.SENT && !isExpired) {
        awaitingQuotes.push(q);
      }
    }
    const quotationsAwaitingReply = {
      count: awaitingQuotes.length,
      value: formatMoney(sumMoney(awaitingQuotes.map((q) => q.total))),
    };

    // Billed invoices only (AC2: ISSUED, PARTIALLY_PAID, PAID)
    const billedInvoices = invoices.filter((inv: any) => BILLED_INVOICE_STATUSES.has(inv.status));

    // Invoiced this month = invoices issued this month less credit notes issued this month (on billed invoices)
    const invoicesIssuedThisMonth = billedInvoices.filter((inv: any) => {
      const d = formatDateOnly(inv.issueDate);
      return d && d.slice(0, 7) === currentMonth;
    });
    const creditNotesThisMonth = creditNotes.filter((cn: any) => {
      const inv = cn.invoice || invoices.find((i: any) => i.id === cn.invoiceId);
      if (!inv || !BILLED_INVOICE_STATUSES.has(inv.status)) return false;
      const d = formatDateOnly(cn.issueDate);
      return d && d.slice(0, 7) === currentMonth;
    });

    const grossInvoicedThisMonth = toDecimal(
      sumMoney(invoicesIssuedThisMonth.map((i: any) => i.total)),
    );
    const cnThisMonthTotal = toDecimal(
      sumMoney(creditNotesThisMonth.map((cn: any) => cn.total)),
    );
    const invoicedThisMonth = formatMoney(grossInvoicedThisMonth.sub(cnThisMonthTotal));

    // Received this month
    const paymentsThisMonth = payments.filter((p: any) => {
      const d = formatDateOnly(p.receivedDate);
      return d && d.slice(0, 7) === currentMonth;
    });
    const receivedThisMonth = formatMoney(sumMoney(paymentsThisMonth.map((p: any) => p.amount)));

    // Expenses this month (non-VOID)
    const activeExpensesThisMonth = expenses.filter((e: any) => {
      if (e.status === ExpenseStatus.VOID) return false;
      const d = formatDateOnly(e.expenseDate);
      return d && d.slice(0, 7) === currentMonth;
    });
    const expensesThisMonth = formatMoney(
      sumMoney(activeExpensesThisMonth.map((e: any) => e.total)),
    );

    // Total outstanding across ISSUED and PARTIALLY_PAID invoices
    const openInvoices = invoices.filter((inv: any) =>
      OUTSTANDING_INVOICE_STATUSES.has(inv.status),
    );
    const totalOutstandingDec = sumMoney(
      openInvoices.map((inv: any) => {
        const bal = toDecimal(inv.total).sub(toDecimal(inv.amountPaid || 0));
        return bal.gt(0) ? bal : toDecimal(0);
      }),
    );
    const totalOutstanding = formatMoney(totalOutstandingDec);

    // Total retention held across all projects
    let totalRetentionHeldDec = toDecimal(0);
    for (const proj of projects) {
      const projBilled = billedInvoices.filter((inv: any) => inv.projectId === proj.id);
      const claims = projBilled
        .filter((inv: any) => inv.type === InvoiceType.PROGRESS_CLAIM)
        .sort((a: any, b: any) => (b.claimNo || 0) - (a.claimNo || 0));
      const latestRetention =
        claims.length > 0 ? toDecimal(claims[0].retentionToDate || 0) : toDecimal(0);
      const releases = projBilled.filter((inv: any) => inv.type === InvoiceType.RETENTION_RELEASE);
      const releasedDec = toDecimal(sumMoney(releases.map((r: any) => r.subtotal)));
      const heldBalance = latestRetention.sub(releasedDec);
      if (heldBalance.gt(0)) {
        totalRetentionHeldDec = totalRetentionHeldDec.add(heldBalance);
      }
    }
    const totalRetentionHeld = formatMoney(totalRetentionHeldDec);

    // ACTIVE projects with no daily report for yesterday (when yesterday was a working day)
    const projectsWithNoReportYesterday: Array<{
      id: string;
      code: string;
      name: string;
      status: string;
    }> = [];
    if (isWorkingDay(yesterday)) {
      const reportedProjectIds = new Set<string>(
        dailyReports
          .filter((dr: any) => formatDateOnly(dr.reportDate) === yesterday)
          .map((dr: any) => dr.projectId),
      );
      for (const proj of activeProjectList) {
        const startStr = formatDateOnly(proj.startDate);
        const endStr = formatDateOnly(proj.endDate);
        if (startStr && startStr > yesterday) continue;
        if (endStr && endStr < yesterday) continue;
        if (!reportedProjectIds.has(proj.id)) {
          projectsWithNoReportYesterday.push({
            id: proj.id,
            code: proj.code,
            name: proj.name,
            status: proj.status,
          });
        }
      }
    }

    return {
      activeProjects,
      quotationsAwaitingReply,
      invoicedThisMonth,
      receivedThisMonth,
      expensesThisMonth,
      totalOutstanding,
      totalRetentionHeld,
      projectsWithNoReportYesterday,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Project Summary (/reports/projects/:id/summary)
  // ---------------------------------------------------------------------------

  async getProjectSummary(
    user: AuthUser,
    projectId: string,
    query: { from?: string; to?: string } = {},
  ) {
    await this.projectAccessService.assertMember(user, projectId);

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw AppException.notFound('NOT_FOUND', 'Project not found');
    }

    const [vos, invoices, allocations, dailyReports, projectExpenses] = await Promise.all([
      this.prisma.variationOrder.findMany({ where: { projectId } }),
      this.prisma.invoice.findMany({ where: { projectId } }),
      this.prisma.paymentAllocation.findMany({ include: { invoice: true } }),
      this.prisma.dailyReport.findMany({
        where: { projectId },
        include: { photos: true },
        orderBy: { reportDate: 'desc' },
      }),
      this.prisma.expense.findMany({ where: { projectId } }),
    ]);

    const activeProjectExpenses = projectExpenses.filter(
      (e: any) => e.status !== ExpenseStatus.VOID,
    );
    const totalExpensesDec = toDecimal(sumMoney(activeProjectExpenses.map((e: any) => e.total)));

    const contractSumDec = toDecimal(project.contractSum || 0);
    const approvedVos = vos.filter((v: any) => v.status === VariationStatus.APPROVED);
    const approvedVariationsDec = toDecimal(sumMoney(approvedVos.map((v: any) => v.total)));
    const revisedContractDec = contractSumDec.add(approvedVariationsDec);

    const billedInvoices = invoices.filter((inv: any) => BILLED_INVOICE_STATUSES.has(inv.status));
    const billedInvoiceIds = new Set(billedInvoices.map((inv: any) => inv.id));

    const billedClaims = billedInvoices
      .filter((inv: any) => inv.type === InvoiceType.PROGRESS_CLAIM)
      .sort((a: any, b: any) => (b.claimNo || 0) - (a.claimNo || 0));

    const latestClaim = billedClaims[0] || null;
    const claimedToDateDec = latestClaim ? toDecimal(latestClaim.grossToDate || 0) : toDecimal(0);

    // Paid to date = sum of payment allocations on billed invoices of this project
    const projectAllocations = allocations.filter((a: any) => billedInvoiceIds.has(a.invoiceId));
    const paidToDateDec = sumMoney(projectAllocations.map((a: any) => a.amount));

    // Outstanding = sum of balances on ISSUED and PARTIALLY_PAID invoices of this project
    const openInvoices = billedInvoices.filter((inv: any) =>
      OUTSTANDING_INVOICE_STATUSES.has(inv.status),
    );
    const outstandingDec = sumMoney(
      openInvoices.map((inv: any) => {
        const bal = toDecimal(inv.total).sub(toDecimal(inv.amountPaid || 0));
        return bal.gt(0) ? bal : toDecimal(0);
      }),
    );

    // Retention held = latestClaim.retentionToDate - sum of billed RETENTION_RELEASE subtotals
    const latestRetentionDec = latestClaim
      ? toDecimal(latestClaim.retentionToDate || 0)
      : toDecimal(0);
    const billedReleases = billedInvoices.filter(
      (inv: any) => inv.type === InvoiceType.RETENTION_RELEASE,
    );
    const releasedDec = toDecimal(sumMoney(billedReleases.map((r: any) => r.subtotal)));
    const retentionHeldDec = latestRetentionDec.sub(releasedDec).gt(0)
      ? latestRetentionDec.sub(releasedDec)
      : toDecimal(0);

    const percentClaimed = revisedContractDec.gt(0)
      ? formatPercent(roundMoney(claimedToDateDec.div(revisedContractDec).mul(100)))
      : '0.00';

    const today = todayKualaLumpur();
    const defaultFrom = formatDateOnly(project.startDate) || today;
    const defaultTo =
      formatDateOnly(project.endDate) && formatDateOnly(project.endDate)! < today
        ? formatDateOnly(project.endDate)!
        : today;

    const rangeFrom = query.from || defaultFrom;
    const rangeTo = query.to || defaultTo;

    const workingDaySet = new Set(listWorkingDaysInRange(rangeFrom, rangeTo));
    const reportedWorkingDays = new Set<string>();
    for (const dr of dailyReports) {
      const d = formatDateOnly(dr.reportDate);
      if (d && workingDaySet.has(d)) {
        reportedWorkingDays.add(d);
      }
    }

    const latestPhotos: Array<{
      fileId: string;
      url: string;
      caption: string | null;
      takenAt: string | null;
      dailyReportId: string;
      reportDate: string;
    }> = [];

    for (const dr of dailyReports) {
      const reportDateStr = formatDateOnly(dr.reportDate) || today;
      const photos = (dr.photos || [])
        .slice()
        .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      for (const p of photos) {
        if (latestPhotos.length >= 12) break;
        const { url } = await this.filesService.getDownloadUrl(p.fileId);
        latestPhotos.push({
          fileId: p.fileId,
          url,
          caption: p.caption ?? null,
          takenAt: p.takenAt ? new Date(p.takenAt).toISOString() : null,
          dailyReportId: dr.id,
          reportDate: reportDateStr,
        });
      }
      if (latestPhotos.length >= 12) break;
    }

    const grossProfitDec = claimedToDateDec.sub(totalExpensesDec);

    return {
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
        status: project.status,
      },
      contractSum: formatMoney(contractSumDec),
      approvedVariations: formatMoney(approvedVariationsDec),
      claimedToDate: formatMoney(claimedToDateDec),
      paidToDate: formatMoney(paidToDateDec),
      outstanding: formatMoney(outstandingDec),
      retentionHeld: formatMoney(retentionHeldDec),
      totalExpenses: formatMoney(totalExpensesDec),
      grossProfit: formatMoney(grossProfitDec),
      percentClaimed,
      daysWithReports: reportedWorkingDays.size,
      workingDays: workingDaySet.size,
      latestPhotos,
    };
  }

  // ---------------------------------------------------------------------------
  // 3. Receivables Ageing (/reports/receivables-ageing)
  // ---------------------------------------------------------------------------

  async getReceivablesAgeing(
    query: { asOf?: string; clientId?: string; projectId?: string } = {},
  ) {
    const asOf = query.asOf || todayKualaLumpur();
    const invoices = await this.prisma.invoice.findMany({
      include: { client: true },
    });

    const byClient = new Map<
      string,
      {
        client: { id: string; code?: string | null; name: string; tin: string | null };
        current: any;
        days1To30: any;
        days31To60: any;
        days61To90: any;
        days90Plus: any;
        total: any;
      }
    >();

    for (const inv of invoices) {
      if (!OUTSTANDING_INVOICE_STATUSES.has(inv.status)) continue;
      if (query.clientId && inv.clientId !== query.clientId) continue;
      if (query.projectId && inv.projectId !== query.projectId) continue;

      const issueDateStr = formatDateOnly(inv.issueDate);
      if (issueDateStr && issueDateStr > asOf) continue;

      const balance = toDecimal(inv.total).sub(toDecimal(inv.amountPaid || 0));
      if (balance.lte(0)) continue;

      const dueDateStr = formatDateOnly(inv.dueDate) || issueDateStr || asOf;
      const overdueDays = diffDays(asOf, dueDateStr);

      let bucket = byClient.get(inv.clientId);
      if (!bucket) {
        bucket = {
          client: {
            id: inv.client?.id || inv.clientId,
            code: inv.client?.code ?? null,
            name: inv.client?.name || 'Unknown Client',
            tin: inv.client?.tin ?? null,
          },
          current: toDecimal(0),
          days1To30: toDecimal(0),
          days31To60: toDecimal(0),
          days61To90: toDecimal(0),
          days90Plus: toDecimal(0),
          total: toDecimal(0),
        };
        byClient.set(inv.clientId, bucket);
      }

      if (overdueDays <= 0) {
        bucket.current = bucket.current.add(balance);
      } else if (overdueDays <= 30) {
        bucket.days1To30 = bucket.days1To30.add(balance);
      } else if (overdueDays <= 60) {
        bucket.days31To60 = bucket.days31To60.add(balance);
      } else if (overdueDays <= 90) {
        bucket.days61To90 = bucket.days61To90.add(balance);
      } else {
        bucket.days90Plus = bucket.days90Plus.add(balance);
      }
      bucket.total = bucket.total.add(balance);
    }

    const rows = Array.from(byClient.values())
      .sort((a, b) => a.client.name.localeCompare(b.client.name))
      .map((r) => ({
        client: r.client,
        current: formatMoney(r.current),
        days1To30: formatMoney(r.days1To30),
        days31To60: formatMoney(r.days31To60),
        days61To90: formatMoney(r.days61To90),
        days90Plus: formatMoney(r.days90Plus),
        total: formatMoney(r.total),
      }));

    const totals = {
      current: formatMoney(sumMoney(rows.map((r) => r.current))),
      days1To30: formatMoney(sumMoney(rows.map((r) => r.days1To30))),
      days31To60: formatMoney(sumMoney(rows.map((r) => r.days31To60))),
      days61To90: formatMoney(sumMoney(rows.map((r) => r.days61To90))),
      days90Plus: formatMoney(sumMoney(rows.map((r) => r.days90Plus))),
      total: formatMoney(sumMoney(rows.map((r) => r.total))),
    };

    return {
      asOf,
      rows,
      totals,
    };
  }

  // ---------------------------------------------------------------------------
  // 4. Quotation Pipeline (/reports/quotation-pipeline)
  // ---------------------------------------------------------------------------

  async getQuotationPipeline(
    query: { from?: string; to?: string; clientId?: string } = {},
  ) {
    const today = todayKualaLumpur();
    const all = await this.prisma.quotation.findMany();

    // Only the latest revision per quotation rootId
    const latestByRoot = new Map<string, any>();
    for (const q of all) {
      const prev = latestByRoot.get(q.rootId);
      if (!prev || q.revisionNo > prev.revisionNo) {
        latestByRoot.set(q.rootId, q);
      }
    }

    const filtered: Array<{ status: string; total: any; month: string }> = [];
    for (const q of latestByRoot.values()) {
      if (query.clientId && q.clientId !== query.clientId) continue;
      const issueDateStr = formatDateOnly(q.issueDate);
      if (!issueDateStr) continue;
      if (query.from && issueDateStr < query.from) continue;
      if (query.to && issueDateStr > query.to) continue;

      const validUntilStr = formatDateOnly(q.validUntil);
      const effectiveStatus =
        q.status === QuotationStatus.SENT && validUntilStr && validUntilStr < today
          ? QuotationStatus.EXPIRED
          : q.status;

      filtered.push({
        status: effectiveStatus,
        total: q.total,
        month: issueDateStr.slice(0, 7),
      });
    }

    const statusOrder = [
      QuotationStatus.DRAFT,
      QuotationStatus.SENT,
      QuotationStatus.ACCEPTED,
      QuotationStatus.REJECTED,
      QuotationStatus.EXPIRED,
    ];

    const buildSummary = (items: Array<{ status: string; total: any }>) => {
      const byStatus = statusOrder.map((st) => {
        const matching = items.filter((i) => i.status === st);
        return {
          status: st,
          count: matching.length,
          value: formatMoney(sumMoney(matching.map((m) => m.total))),
        };
      });

      const accepted = byStatus.find((s) => s.status === QuotationStatus.ACCEPTED)?.count || 0;
      const rejected = byStatus.find((s) => s.status === QuotationStatus.REJECTED)?.count || 0;
      const expired = byStatus.find((s) => s.status === QuotationStatus.EXPIRED)?.count || 0;
      const denom = accepted + rejected + expired;
      const winRate =
        denom > 0
          ? formatPercent(roundMoney(toDecimal(accepted).div(denom).mul(100)))
          : null;

      return { byStatus, winRate };
    };

    const overall = buildSummary(filtered);
    const months = Array.from(new Set(filtered.map((f) => f.month))).sort();
    const byMonth = months.map((m) => {
      const monthItems = filtered.filter((f) => f.month === m);
      const summary = buildSummary(monthItems);
      return {
        month: m,
        byStatus: summary.byStatus,
        winRate: summary.winRate,
      };
    });

    return {
      from: query.from ?? null,
      to: query.to ?? null,
      byStatus: overall.byStatus,
      winRate: overall.winRate,
      byMonth,
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Billing & Collections (/reports/billing-collections)
  // ---------------------------------------------------------------------------

  async getBillingCollections(
    query: { from?: string; to?: string; clientId?: string; projectId?: string } = {},
  ) {
    const today = todayKualaLumpur();
    const defaultToDate = today;
    const defaultFromDate = addMonths(today.slice(0, 8) + '01', -11);

    const fromDate = query.from || defaultFromDate;
    const toDate = query.to || defaultToDate;
    const fromMonth = fromDate.slice(0, 7);
    const toMonth = toDate.slice(0, 7);

    const monthKeys = listMonthsInRange(fromMonth, toMonth);

    const [invoices, creditNotes, payments] = await Promise.all([
      this.prisma.invoice.findMany(),
      this.prisma.creditNote.findMany({ include: { invoice: true } }),
      this.prisma.payment.findMany({ include: { allocations: true } }),
    ]);

    const invoiceById = new Map<string, any>(invoices.map((i: any) => [i.id, i]));

    // Billed invoices matching filters
    const billedInvoices = invoices.filter((inv: any) => {
      if (!BILLED_INVOICE_STATUSES.has(inv.status)) return false;
      if (query.clientId && inv.clientId !== query.clientId) return false;
      if (query.projectId && inv.projectId !== query.projectId) return false;
      const d = formatDateOnly(inv.issueDate);
      if (!d) return false;
      if (query.from && d < query.from) return false;
      if (query.to && d > query.to) return false;
      return true;
    });

    const matchingCreditNotes = creditNotes.filter((cn: any) => {
      const inv = cn.invoice || invoiceById.get(cn.invoiceId);
      if (!inv || !BILLED_INVOICE_STATUSES.has(inv.status)) return false;
      if (query.clientId && inv.clientId !== query.clientId) return false;
      if (query.projectId && inv.projectId !== query.projectId) return false;
      const d = formatDateOnly(cn.issueDate);
      if (!d) return false;
      if (query.from && d < query.from) return false;
      if (query.to && d > query.to) return false;
      return true;
    });

    const invoicedByMonth = new Map<string, any>();
    const receivedByMonth = new Map<string, any>();
    for (const m of monthKeys) {
      invoicedByMonth.set(m, toDecimal(0));
      receivedByMonth.set(m, toDecimal(0));
    }

    for (const inv of billedInvoices) {
      const d = formatDateOnly(inv.issueDate);
      if (!d) continue;
      const m = d.slice(0, 7);
      if (invoicedByMonth.has(m)) {
        invoicedByMonth.set(m, invoicedByMonth.get(m).add(toDecimal(inv.total)));
      }
    }

    for (const cn of matchingCreditNotes) {
      const d = formatDateOnly(cn.issueDate);
      if (!d) continue;
      const m = d.slice(0, 7);
      if (invoicedByMonth.has(m)) {
        invoicedByMonth.set(m, invoicedByMonth.get(m).sub(toDecimal(cn.total)));
      }
    }

    for (const p of payments) {
      if (query.clientId && p.clientId !== query.clientId) continue;
      const d = formatDateOnly(p.receivedDate);
      if (!d) continue;
      if (query.from && d < query.from) continue;
      if (query.to && d > query.to) continue;
      const m = d.slice(0, 7);
      if (!receivedByMonth.has(m)) continue;

      if (query.projectId) {
        // When filtering by projectId, sum only allocations to invoices of that project
        const projAllocTotal = sumMoney(
          (p.allocations || [])
            .filter((a: any) => invoiceById.get(a.invoiceId)?.projectId === query.projectId)
            .map((a: any) => a.amount),
        );
        receivedByMonth.set(m, receivedByMonth.get(m).add(projAllocTotal));
      } else {
        receivedByMonth.set(m, receivedByMonth.get(m).add(toDecimal(p.amount)));
      }
    }

    const months = monthKeys.map((m) => ({
      month: m,
      invoiced: formatMoney(invoicedByMonth.get(m) || 0),
      received: formatMoney(receivedByMonth.get(m) || 0),
    }));

    const totals = {
      invoiced: formatMoney(sumMoney(months.map((m) => m.invoiced))),
      received: formatMoney(sumMoney(months.map((m) => m.received))),
    };

    return {
      months,
      totals,
    };
  }

  // ---------------------------------------------------------------------------
  // 6. Retention Register (/reports/retention)
  // ---------------------------------------------------------------------------

  async getRetentionRegister(
    user: AuthUser,
    query: { clientId?: string; projectId?: string } = {},
  ) {
    const allowedIds = await this.projectAccessService.getAccessibleProjectIds(user);
    const [projects, invoices] = await Promise.all([
      this.prisma.project.findMany({
        include: { client: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.invoice.findMany(),
    ]);

    const billedInvoices = invoices.filter((inv: any) => BILLED_INVOICE_STATUSES.has(inv.status));

    const rows: Array<{
      project: { id: string; code: string; name: string; status: string };
      client: { id: string; code?: string | null; name: string; tin: string | null };
      held: string;
      released: string;
      balance: string;
      expectedReleases: Array<{
        date: string;
        amount: string;
        milestone: 'PRACTICAL_COMPLETION' | 'END_OF_DEFECTS_LIABILITY';
      }>;
    }> = [];

    for (const proj of projects) {
      if (allowedIds !== null && !allowedIds.includes(proj.id)) continue;
      if (query.clientId && proj.clientId !== query.clientId) continue;
      if (query.projectId && proj.id !== query.projectId) continue;

      const projBilled = billedInvoices.filter((inv: any) => inv.projectId === proj.id);
      const claims = projBilled
        .filter((inv: any) => inv.type === InvoiceType.PROGRESS_CLAIM)
        .sort((a: any, b: any) => (b.claimNo || 0) - (a.claimNo || 0));

      const heldDec =
        claims.length > 0 ? toDecimal(claims[0].retentionToDate || 0) : toDecimal(0);
      const releases = projBilled.filter(
        (inv: any) => inv.type === InvoiceType.RETENTION_RELEASE,
      );
      const releasedDec = toDecimal(sumMoney(releases.map((r: any) => r.subtotal)));
      const balanceDec = heldDec.sub(releasedDec).gt(0)
        ? heldDec.sub(releasedDec)
        : toDecimal(0);

      if (heldDec.eq(0) && releasedDec.eq(0) && !query.projectId) {
        continue;
      }

      const expectedReleases: Array<{
        date: string;
        amount: string;
        milestone: 'PRACTICAL_COMPLETION' | 'END_OF_DEFECTS_LIABILITY';
      }> = [];

      const endDateStr = formatDateOnly(proj.endDate);
      if (endDateStr && balanceDec.gt(0)) {
        const halfHeld = roundMoney(heldDec.div(2));
        const dlpMonths = Number(proj.defectsLiabilityMonths ?? 12);
        const dlpEndStr = addMonths(endDateStr, dlpMonths);

        if (releasedDec.lt(halfHeld)) {
          const firstTranche = halfHeld.sub(releasedDec);
          const secondTranche = balanceDec.sub(firstTranche);
          expectedReleases.push({
            date: endDateStr,
            amount: formatMoney(firstTranche),
            milestone: 'PRACTICAL_COMPLETION',
          });
          if (secondTranche.gt(0)) {
            expectedReleases.push({
              date: dlpEndStr,
              amount: formatMoney(secondTranche),
              milestone: 'END_OF_DEFECTS_LIABILITY',
            });
          }
        } else {
          expectedReleases.push({
            date: dlpEndStr,
            amount: formatMoney(balanceDec),
            milestone: 'END_OF_DEFECTS_LIABILITY',
          });
        }
      }

      rows.push({
        project: {
          id: proj.id,
          code: proj.code,
          name: proj.name,
          status: proj.status,
        },
        client: {
          id: proj.client?.id || proj.clientId,
          code: proj.client?.code ?? null,
          name: proj.client?.name || 'Unknown Client',
          tin: proj.client?.tin ?? null,
        },
        held: formatMoney(heldDec),
        released: formatMoney(releasedDec),
        balance: formatMoney(balanceDec),
        expectedReleases,
      });
    }

    const totals = {
      held: formatMoney(sumMoney(rows.map((r) => r.held))),
      released: formatMoney(sumMoney(rows.map((r) => r.released))),
      balance: formatMoney(sumMoney(rows.map((r) => r.balance))),
    };

    return {
      rows,
      totals,
    };
  }

  // ---------------------------------------------------------------------------
  // 7. Daily Report Compliance (/reports/daily-report-compliance)
  // ---------------------------------------------------------------------------

  async getDailyReportCompliance(
    user: AuthUser,
    query: { from?: string; to?: string; projectId?: string },
  ) {
    if (!query.from || !query.to || query.from > query.to) {
      throw AppException.unprocessable(
        'VALIDATION_ERROR',
        'Valid from and to dates (YYYY-MM-DD) are required',
      );
    }

    const allowedIds = await this.projectAccessService.getAccessibleProjectIds(user);
    const [projects, members, dailyReports] = await Promise.all([
      this.prisma.project.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.projectMember.findMany({ include: { user: true } }),
      this.prisma.dailyReport.findMany(),
    ]);

    const byProject: Array<{
      project: { id: string; code: string; name: string; status: string };
      expected: number;
      submitted: number;
      compliancePercent: string;
    }> = [];

    const bySiteStaff: Array<{
      user: { id: string; name: string; role: string };
      project: { id: string; code: string; name: string; status: string };
      expected: number;
      submitted: number;
      compliancePercent: string;
    }> = [];

    for (const proj of projects) {
      if (allowedIds !== null && !allowedIds.includes(proj.id)) continue;
      if (query.projectId && proj.id !== query.projectId) continue;
      if (proj.status !== ProjectStatus.ACTIVE && !query.projectId) continue;

      const projStart = formatDateOnly(proj.startDate);
      const projEnd = formatDateOnly(proj.endDate);
      const effectiveFrom = projStart && projStart > query.from ? projStart : query.from;
      const effectiveTo = projEnd && projEnd < query.to ? projEnd : query.to;

      const workingDays = listWorkingDaysInRange(effectiveFrom, effectiveTo);
      const workingDaySet = new Set(workingDays);
      const expected = workingDaySet.size;

      const projReports = dailyReports.filter((dr: any) => {
        if (dr.projectId !== proj.id) return false;
        const d = formatDateOnly(dr.reportDate);
        return d !== null && workingDaySet.has(d);
      });

      const submittedDays = new Set<string>(
        projReports.map((dr: any) => formatDateOnly(dr.reportDate)!),
      );
      const submitted = submittedDays.size;
      const compliancePercent =
        expected > 0
          ? formatPercent(roundMoney(toDecimal(submitted).div(expected).mul(100)))
          : '0.00';

      const projectRef = {
        id: proj.id,
        code: proj.code,
        name: proj.name,
        status: proj.status,
      };

      byProject.push({
        project: projectRef,
        expected,
        submitted,
        compliancePercent,
      });

      const siteStaffMembers = members.filter(
        (m: any) => m.projectId === proj.id && m.user && m.user.role === Role.SITE_STAFF,
      );

      for (const m of siteStaffMembers) {
        const staffDays = new Set<string>(
          projReports
            .filter((dr: any) => dr.submittedById === m.userId)
            .map((dr: any) => formatDateOnly(dr.reportDate)!),
        );
        const staffSubmitted = staffDays.size;
        const staffCompliance =
          expected > 0
            ? formatPercent(roundMoney(toDecimal(staffSubmitted).div(expected).mul(100)))
            : '0.00';

        bySiteStaff.push({
          user: {
            id: m.user.id,
            name: m.user.name,
            role: m.user.role,
          },
          project: projectRef,
          expected,
          submitted: staffSubmitted,
          compliancePercent: staffCompliance,
        });
      }
    }

    return {
      from: query.from,
      to: query.to,
      byProject,
      bySiteStaff,
    };
  }

  // ---------------------------------------------------------------------------
  // 8. Expenses & Job Costing Report (/reports/expenses) (Spec 07)
  // ---------------------------------------------------------------------------

  async getExpensesReport(
    user: AuthUser,
    query: { from?: string; to?: string; projectId?: string; category?: string } = {},
  ) {
    const allowedProjectIds = await this.projectAccessService.getAccessibleProjectIds(user);
    const all = await this.prisma.expense.findMany({
      include: { project: true },
      orderBy: { expenseDate: 'desc' },
    });

    const filtered = all.filter((exp: any) => {
      if (exp.status === ExpenseStatus.VOID) return false;
      if (allowedProjectIds !== null) {
        if (!exp.projectId || !allowedProjectIds.includes(exp.projectId)) return false;
      }
      if (query.projectId && exp.projectId !== query.projectId) return false;
      if (query.category && exp.category !== query.category) return false;
      const d = formatDateOnly(exp.expenseDate);
      if (query.from && (!d || d < query.from)) return false;
      if (query.to && (!d || d > query.to)) return false;
      return true;
    });

    const categories = Object.values(ExpenseCategory);
    const byCategory = categories.map((cat) => {
      const matching = filtered.filter((e: any) => e.category === cat);
      return {
        category: cat,
        count: matching.length,
        total: formatMoney(sumMoney(matching.map((m: any) => m.total))),
      };
    });

    const projectMap = new Map<
      string,
      {
        projectCode: string;
        projectName: string;
        count: number;
        totalDec: any;
      }
    >();

    for (const exp of filtered) {
      const key = exp.projectId || 'GENERAL_OVERHEAD';
      let entry = projectMap.get(key);
      if (!entry) {
        entry = {
          projectCode: exp.projectCodeRef || exp.project?.code || 'OVERHEAD',
          projectName: exp.project?.name || 'General Company Overhead',
          count: 0,
          totalDec: toDecimal(0),
        };
        projectMap.set(key, entry);
      }
      entry.count++;
      entry.totalDec = entry.totalDec.add(toDecimal(exp.total));
    }

    const byProject = Array.from(projectMap.values())
      .sort((a, b) => a.projectCode.localeCompare(b.projectCode))
      .map((p) => ({
        projectCode: p.projectCode,
        projectName: p.projectName,
        count: p.count,
        total: formatMoney(p.totalDec),
      }));

    const paidList = filtered.filter(
      (e: any) => e.status === ExpenseStatus.PAID || e.status === ExpenseStatus.REIMBURSED,
    );
    const unpaidList = filtered.filter((e: any) => e.status === ExpenseStatus.UNPAID);

    const totals = {
      totalExpenses: formatMoney(sumMoney(filtered.map((e: any) => e.total))),
      totalPaid: formatMoney(sumMoney(paidList.map((e: any) => e.total))),
      totalUnpaid: formatMoney(sumMoney(unpaidList.map((e: any) => e.total))),
    };

    return {
      from: query.from ?? null,
      to: query.to ?? null,
      byCategory,
      byProject,
      totals,
    };
  }

  // ---------------------------------------------------------------------------
  // 9. Excel Export Helpers (T08 & Spec 07)
  // ---------------------------------------------------------------------------

  buildDashboardXlsx(data: Awaited<ReturnType<ReportsService['getDashboard']>>): Buffer {
    const sheets: XlsxSheet[] = [
      {
        name: 'Dashboard',
        headers: ['Metric', 'Value'],
        rows: [
          ['Active Projects', data.activeProjects],
          ['Quotations Awaiting Reply (Count)', data.quotationsAwaitingReply.count],
          ['Quotations Awaiting Reply (RM)', data.quotationsAwaitingReply.value],
          ['Invoiced This Month (RM)', data.invoicedThisMonth],
          ['Received This Month (RM)', data.receivedThisMonth],
          ['Expenses This Month (RM)', data.expensesThisMonth],
          ['Total Outstanding (RM)', data.totalOutstanding],
          ['Total Retention Held (RM)', data.totalRetentionHeld],
        ],
      },
      {
        name: 'Missing Report Yesterday',
        headers: ['Project Code', 'Project Name', 'Status'],
        rows: data.projectsWithNoReportYesterday.map((p) => [p.code, p.name, p.status]),
      },
    ];
    return buildXlsxBuffer(sheets);
  }

  buildProjectSummaryXlsx(data: Awaited<ReturnType<ReportsService['getProjectSummary']>>): Buffer {
    return buildXlsxBuffer([
      {
        name: 'Project Summary',
        headers: ['Field', 'Value'],
        rows: [
          ['Project Code', data.project.code],
          ['Project Name', data.project.name],
          ['Status', data.project.status],
          ['Original Contract Sum (RM)', data.contractSum],
          ['Approved Variations (RM)', data.approvedVariations],
          ['Claimed To Date (RM)', data.claimedToDate],
          ['Paid To Date (RM)', data.paidToDate],
          ['Outstanding (RM)', data.outstanding],
          ['Retention Held (RM)', data.retentionHeld],
          ['Total Expenses (RM)', data.totalExpenses],
          ['Gross Profit (RM)', data.grossProfit],
          ['Percent Claimed (%)', data.percentClaimed],
          ['Days With Reports', data.daysWithReports],
          ['Working Days', data.workingDays],
        ],
      },
    ]);
  }

  buildExpensesReportXlsx(
    data: Awaited<ReturnType<ReportsService['getExpensesReport']>>,
  ): Buffer {
    return buildXlsxBuffer([
      {
        name: 'By Category',
        headers: ['Category', 'Count', 'Total (RM)'],
        rows: [
          ...data.byCategory.map((c) => [c.category, c.count, c.total]),
          ['TOTAL EXPENSES', '', data.totals.totalExpenses],
          ['TOTAL PAID', '', data.totals.totalPaid],
          ['TOTAL UNPAID', '', data.totals.totalUnpaid],
        ],
      },
      {
        name: 'By Project',
        headers: ['Project Code', 'Project Name', 'Count', 'Total (RM)'],
        rows: data.byProject.map((p) => [p.projectCode, p.projectName, p.count, p.total]),
      },
    ]);
  }

  buildReceivablesAgeingXlsx(
    data: Awaited<ReturnType<ReportsService['getReceivablesAgeing']>>,
  ): Buffer {
    return buildXlsxBuffer([
      {
        name: 'Receivables Ageing',
        headers: [
          'Client',
          'TIN',
          'Current (RM)',
          '1-30 Days (RM)',
          '31-60 Days (RM)',
          '61-90 Days (RM)',
          '90+ Days (RM)',
          'Total (RM)',
        ],
        rows: [
          ...data.rows.map((r) => [
            r.client.name,
            r.client.tin || '',
            r.current,
            r.days1To30,
            r.days31To60,
            r.days61To90,
            r.days90Plus,
            r.total,
          ]),
          [
            'TOTAL',
            '',
            data.totals.current,
            data.totals.days1To30,
            data.totals.days31To60,
            data.totals.days61To90,
            data.totals.days90Plus,
            data.totals.total,
          ],
        ],
      },
    ]);
  }

  buildQuotationPipelineXlsx(
    data: Awaited<ReturnType<ReportsService['getQuotationPipeline']>>,
  ): Buffer {
    return buildXlsxBuffer([
      {
        name: 'By Status',
        headers: ['Status', 'Count', 'Value (RM)'],
        rows: [
          ...data.byStatus.map((s) => [s.status, s.count, s.value]),
          ['Win Rate (%)', '', data.winRate ?? 'N/A'],
        ],
      },
      {
        name: 'By Month',
        headers: ['Month', 'Status', 'Count', 'Value (RM)', 'Month Win Rate (%)'],
        rows: data.byMonth.flatMap((m) =>
          m.byStatus.map((s) => [m.month, s.status, s.count, s.value, m.winRate ?? 'N/A']),
        ),
      },
    ]);
  }

  buildBillingCollectionsXlsx(
    data: Awaited<ReturnType<ReportsService['getBillingCollections']>>,
  ): Buffer {
    return buildXlsxBuffer([
      {
        name: 'Billing & Collections',
        headers: ['Month', 'Invoiced (RM)', 'Received (RM)'],
        rows: [
          ...data.months.map((m) => [m.month, m.invoiced, m.received]),
          ['TOTAL', data.totals.invoiced, data.totals.received],
        ],
      },
    ]);
  }

  buildRetentionRegisterXlsx(
    data: Awaited<ReturnType<ReportsService['getRetentionRegister']>>,
  ): Buffer {
    return buildXlsxBuffer([
      {
        name: 'Retention Register',
        headers: [
          'Project Code',
          'Project Name',
          'Client',
          'Held (RM)',
          'Released (RM)',
          'Balance (RM)',
          'Expected Releases',
        ],
        rows: [
          ...data.rows.map((r) => [
            r.project.code,
            r.project.name,
            r.client.name,
            r.held,
            r.released,
            r.balance,
            r.expectedReleases.map((e) => `${e.milestone}: ${e.date} (RM ${e.amount})`).join('; '),
          ]),
          ['TOTAL', '', '', data.totals.held, data.totals.released, data.totals.balance, ''],
        ],
      },
    ]);
  }

  buildDailyReportComplianceXlsx(
    data: Awaited<ReturnType<ReportsService['getDailyReportCompliance']>>,
  ): Buffer {
    return buildXlsxBuffer([
      {
        name: 'By Project',
        headers: ['Project Code', 'Project Name', 'Expected Working Days', 'Submitted Days', 'Compliance (%)'],
        rows: data.byProject.map((p) => [
          p.project.code,
          p.project.name,
          p.expected,
          p.submitted,
          p.compliancePercent,
        ]),
      },
      {
        name: 'By Site Staff',
        headers: ['Staff Name', 'Project Code', 'Expected Working Days', 'Submitted Days', 'Compliance (%)'],
        rows: data.bySiteStaff.map((s) => [
          s.user.name,
          s.project.code,
          s.expected,
          s.submitted,
          s.compliancePercent,
        ]),
      },
    ]);
  }
}
