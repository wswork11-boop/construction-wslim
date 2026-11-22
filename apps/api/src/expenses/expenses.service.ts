import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import {
  ExpenseCreate,
  ExpensePay,
  ExpenseStatus,
  ExpenseUpdate,
  ExpenseVoid,
  Role,
  formatExpenseNumber,
  formatMoney,
  formatPercent,
  roundMoney,
  sumMoney,
  toDecimal,
} from '@construction/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { AuthUser } from '../common/decorators';
import { AppException } from '../common/errors';
import { ProjectAccessService } from '../common/project-access.service';
import { SequenceService } from '../company/sequence.service';
import { FilesService } from '../files/files.service';

function formatDateOnly(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val.slice(0, 10);
  return val.toISOString().slice(0, 10);
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly projectAccessService: ProjectAccessService,
    private readonly sequenceService: SequenceService,
    private readonly filesService: FilesService,
  ) {}

  private async resolveTaxPercent(taxRateId?: string | null): Promise<string> {
    if (!taxRateId) return '0.00';
    const rate = await this.prisma.taxRate.findUnique({ where: { id: taxRateId } });
    if (!rate || !rate.isActive) {
      throw AppException.unprocessable(
        'TAX_RATE_NOT_FOUND',
        'taxRateId does not exist or is inactive',
      );
    }
    return formatPercent(rate.percent);
  }

  private async serializeExpense(row: any) {
    let receiptUrl: string | null = null;
    if (row.receiptFileId) {
      try {
        const dl = await this.filesService.getDownloadUrl(row.receiptFileId);
        receiptUrl = dl.url;
      } catch {
        receiptUrl = null;
      }
    }

    return {
      id: row.id,
      number: row.number,
      projectId: row.projectId ?? null,
      projectCodeRef: row.projectCodeRef ?? row.project?.code ?? null,
      project: row.project
        ? {
            id: row.project.id,
            code: row.project.code,
            name: row.project.name,
            status: row.project.status,
          }
        : null,
      category: row.category,
      status: row.status,
      expenseDate: formatDateOnly(row.expenseDate),
      vendorName: row.vendorName,
      billReference: row.billReference ?? null,
      description: row.description,
      subtotal: formatMoney(row.subtotal),
      taxRateId: row.taxRateId ?? null,
      taxPercent: formatPercent(row.taxPercent ?? 0),
      taxAmount: formatMoney(row.taxAmount),
      total: formatMoney(row.total),
      paidDate: formatDateOnly(row.paidDate),
      paymentMethod: row.paymentMethod ?? null,
      paymentReference: row.paymentReference ?? null,
      receiptFileId: row.receiptFileId ?? null,
      receiptUrl,
      notes: row.notes ?? null,
      voidedAt: row.voidedAt instanceof Date ? row.voidedAt.toISOString() : row.voidedAt ?? null,
      voidReason: row.voidReason ?? null,
      createdById: row.createdById,
      createdBy: row.createdBy
        ? {
            id: row.createdBy.id,
            name: row.createdBy.name,
            role: row.createdBy.role,
          }
        : undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    };
  }

  async list(
    user: AuthUser,
    query: {
      page: number;
      pageSize: number;
      sort?: string;
      q?: string;
      projectId?: string;
      category?: string;
      status?: string;
      from?: string;
      to?: string;
    },
  ) {
    const allowedProjectIds = await this.projectAccessService.getAccessibleProjectIds(user);

    const all = await this.prisma.expense.findMany({
      include: { project: true, createdBy: true },
      orderBy: { expenseDate: 'desc' },
    });

    const qLower = query.q?.trim().toLowerCase();

    const filtered = all.filter((exp: any) => {
      if (allowedProjectIds !== null) {
        if (!exp.projectId || !allowedProjectIds.includes(exp.projectId)) {
          return false;
        }
      }
      if (query.projectId && exp.projectId !== query.projectId) return false;
      if (query.category && exp.category !== query.category) return false;
      if (query.status && exp.status !== query.status) return false;

      const d = formatDateOnly(exp.expenseDate);
      if (query.from && (!d || d < query.from)) return false;
      if (query.to && (!d || d > query.to)) return false;

      if (qLower) {
        const hay = [
          exp.number,
          exp.vendorName,
          exp.billReference,
          exp.description,
          exp.projectCodeRef,
          exp.project?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(qLower)) return false;
      }

      return true;
    });

    // Summary totals across filtered non-VOID expenses
    const activeFiltered = filtered.filter((e: any) => e.status !== ExpenseStatus.VOID);
    const paidFiltered = activeFiltered.filter(
      (e: any) => e.status === ExpenseStatus.PAID || e.status === ExpenseStatus.REIMBURSED,
    );
    const unpaidFiltered = activeFiltered.filter((e: any) => e.status === ExpenseStatus.UNPAID);

    const summary = {
      totalExpenses: formatMoney(sumMoney(activeFiltered.map((e: any) => e.total))),
      totalPaid: formatMoney(sumMoney(paidFiltered.map((e: any) => e.total))),
      totalUnpaid: formatMoney(sumMoney(unpaidFiltered.map((e: any) => e.total))),
    };

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const start = (query.page - 1) * query.pageSize;
    const pageRows = filtered.slice(start, start + query.pageSize);

    const items = await Promise.all(pageRows.map((r: any) => this.serializeExpense(r)));

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages,
      summary,
    };
  }

  async getById(user: AuthUser, id: string, tx: any = this.prisma) {
    const exp = await tx.expense.findUnique({
      where: { id },
      include: { project: true, createdBy: true },
    });
    if (!exp) {
      throw AppException.notFound('NOT_FOUND', 'Expense not found');
    }

    if (user.role === Role.PROJECT_MANAGER) {
      if (!exp.projectId) {
        throw AppException.forbidden(
          'NOT_PROJECT_MEMBER',
          'Project managers can only access project-linked expenses',
        );
      }
      await this.projectAccessService.assertMember(user, exp.projectId);
    }

    return this.serializeExpense(exp);
  }

  async create(user: AuthUser, dto: ExpenseCreate) {
    if (user.role === Role.PROJECT_MANAGER) {
      if (!dto.projectId) {
        throw AppException.forbidden(
          'NOT_PROJECT_MEMBER',
          'Project managers must link expenses to an assigned project',
        );
      }
      await this.projectAccessService.assertMember(user, dto.projectId);
    }

    let projectCodeRef: string | null = null;
    if (dto.projectId) {
      const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
      if (!project) {
        throw AppException.unprocessable('PROJECT_NOT_FOUND', 'projectId does not exist');
      }
      projectCodeRef = project.code;
    }

    if (dto.receiptFileId) {
      const file = await this.prisma.file.findUnique({ where: { id: dto.receiptFileId } });
      if (!file) {
        throw AppException.unprocessable('FILE_NOT_FOUND', 'receiptFileId does not exist');
      }
    }

    const taxPercentStr = await this.resolveTaxPercent(dto.taxRateId);
    const subtotalDec = roundMoney(dto.amount);
    const taxAmountDec = roundMoney(subtotalDec.mul(toDecimal(taxPercentStr)).div(100));
    const totalDec = subtotalDec.add(taxAmountDec);

    const isPaid = dto.status === ExpenseStatus.PAID || dto.status === ExpenseStatus.REIMBURSED;
    const paidDateStr = isPaid ? dto.paidDate || dto.expenseDate : null;
    const expenseYear = new Date(`${dto.expenseDate}T00:00:00.000Z`).getUTCFullYear();

    return this.prisma.$transaction(async (tx: any) => {
      const rawSeq = await this.sequenceService.next('EXP', tx, expenseYear);
      const number = formatExpenseNumber(rawSeq);
      const id = uuidv7();

      await tx.expense.create({
        data: {
          id,
          number,
          projectId: dto.projectId ?? null,
          projectCodeRef,
          category: dto.category,
          status: dto.status ?? ExpenseStatus.UNPAID,
          expenseDate: new Date(`${dto.expenseDate}T00:00:00.000Z`),
          vendorName: dto.vendorName.trim(),
          billReference: dto.billReference?.trim() || null,
          description: dto.description.trim(),
          subtotal: formatMoney(subtotalDec),
          taxRateId: dto.taxRateId ?? null,
          taxPercent: taxPercentStr,
          taxAmount: formatMoney(taxAmountDec),
          total: formatMoney(totalDec),
          paidDate: paidDateStr ? new Date(`${paidDateStr}T00:00:00.000Z`) : null,
          paymentMethod: isPaid ? dto.paymentMethod || 'BANK_TRANSFER' : null,
          paymentReference: isPaid ? dto.paymentReference || null : null,
          receiptFileId: dto.receiptFileId ?? null,
          notes: dto.notes ?? null,
          createdById: user.id,
        },
      });

      const created = await this.getById(user, id, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Expense',
          entityId: id,
          action: 'CREATE',
          after: created,
        },
        tx,
      );
      return created;
    });
  }

  async update(user: AuthUser, id: string, dto: ExpenseUpdate) {
    const existing = await this.prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      throw AppException.notFound('NOT_FOUND', 'Expense not found');
    }
    if (existing.status === ExpenseStatus.VOID) {
      throw AppException.conflict('EXPENSE_NOT_EDITABLE', 'A voided expense cannot be edited');
    }

    if (user.role === Role.PROJECT_MANAGER) {
      if (!existing.projectId || !dto.projectId) {
        throw AppException.forbidden(
          'NOT_PROJECT_MEMBER',
          'Project managers must link expenses to an assigned project',
        );
      }
      await this.projectAccessService.assertMember(user, existing.projectId);
      if (dto.projectId !== existing.projectId) {
        await this.projectAccessService.assertMember(user, dto.projectId);
      }
    }

    let projectCodeRef: string | null = null;
    if (dto.projectId) {
      const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
      if (!project) {
        throw AppException.unprocessable('PROJECT_NOT_FOUND', 'projectId does not exist');
      }
      projectCodeRef = project.code;
    }

    const taxPercentStr = await this.resolveTaxPercent(dto.taxRateId);
    const subtotalDec = roundMoney(dto.amount);
    const taxAmountDec = roundMoney(subtotalDec.mul(toDecimal(taxPercentStr)).div(100));
    const totalDec = subtotalDec.add(taxAmountDec);

    return this.prisma.$transaction(async (tx: any) => {
      const before = await this.getById(user, id, tx);
      await tx.expense.update({
        where: { id },
        data: {
          projectId: dto.projectId ?? null,
          projectCodeRef,
          category: dto.category,
          expenseDate: new Date(`${dto.expenseDate}T00:00:00.000Z`),
          vendorName: dto.vendorName.trim(),
          billReference: dto.billReference?.trim() || null,
          description: dto.description.trim(),
          subtotal: formatMoney(subtotalDec),
          taxRateId: dto.taxRateId ?? null,
          taxPercent: taxPercentStr,
          taxAmount: formatMoney(taxAmountDec),
          total: formatMoney(totalDec),
          receiptFileId: dto.receiptFileId ?? null,
          notes: dto.notes ?? null,
        },
      });
      const after = await this.getById(user, id, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Expense',
          entityId: id,
          action: 'UPDATE',
          before,
          after,
        },
        tx,
      );
      return after;
    });
  }

  async pay(user: AuthUser, id: string, dto: ExpensePay) {
    const existing = await this.prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      throw AppException.notFound('NOT_FOUND', 'Expense not found');
    }
    if (existing.status === ExpenseStatus.VOID) {
      throw AppException.conflict('EXPENSE_INVALID_STATUS', 'Cannot pay a voided expense');
    }

    return this.prisma.$transaction(async (tx: any) => {
      const before = await this.getById(user, id, tx);
      await tx.expense.update({
        where: { id },
        data: {
          status: dto.status ?? ExpenseStatus.PAID,
          paidDate: new Date(`${dto.paidDate}T00:00:00.000Z`),
          paymentMethod: dto.paymentMethod.trim(),
          paymentReference: dto.paymentReference?.trim() || null,
        },
      });
      const after = await this.getById(user, id, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Expense',
          entityId: id,
          action: 'PAY',
          before,
          after,
        },
        tx,
      );
      return after;
    });
  }

  async void(user: AuthUser, id: string, dto: ExpenseVoid) {
    const existing = await this.prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      throw AppException.notFound('NOT_FOUND', 'Expense not found');
    }
    if (existing.status === ExpenseStatus.VOID) {
      throw AppException.conflict('EXPENSE_INVALID_STATUS', 'Expense is already void');
    }

    return this.prisma.$transaction(async (tx: any) => {
      const before = await this.getById(user, id, tx);
      await tx.expense.update({
        where: { id },
        data: {
          status: ExpenseStatus.VOID,
          voidedAt: new Date(),
          voidReason: dto.reason.trim(),
        },
      });
      const after = await this.getById(user, id, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'Expense',
          entityId: id,
          action: 'VOID',
          before,
          after,
        },
        tx,
      );
      return after;
    });
  }

  async exportExpensesCsv(from: string, to: string): Promise<string> {
    const all = await this.prisma.expense.findMany({
      include: { project: true },
      orderBy: { expenseDate: 'asc' },
    });

    const rows = all.filter((exp: any) => {
      if (exp.status === ExpenseStatus.VOID) return false;
      const d = formatDateOnly(exp.expenseDate);
      return d && d >= from && d <= to;
    });

    const header =
      'ExpenseNumber,ExpenseDate,ProjectCode,Category,Status,VendorName,BillReference,Description,Subtotal,TaxAmount,Total,PaidDate,PaymentMethod,PaymentReference';

    const lines = rows.map((exp: any) =>
      [
        exp.number,
        formatDateOnly(exp.expenseDate) || '',
        exp.projectCodeRef || exp.project?.code || '',
        exp.category,
        exp.status,
        `"${String(exp.vendorName || '').replace(/"/g, '""')}"`,
        `"${String(exp.billReference || '').replace(/"/g, '""')}"`,
        `"${String(exp.description || '').replace(/"/g, '""')}"`,
        formatMoney(exp.subtotal),
        formatMoney(exp.taxAmount),
        formatMoney(exp.total),
        formatDateOnly(exp.paidDate) || '',
        exp.paymentMethod || '',
        `"${String(exp.paymentReference || '').replace(/"/g, '""')}"`,
      ].join(','),
    );

    return [header, ...lines].join('\n');
  }
}
