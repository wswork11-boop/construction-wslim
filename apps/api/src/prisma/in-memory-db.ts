import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { v7 as uuidv7 } from 'uuid';

function toDecimal(val: any): Prisma.Decimal {
  if (val instanceof Prisma.Decimal) return val;
  return new Prisma.Decimal(String(val ?? 0));
}

function toDate(val: any): Date {
  if (val instanceof Date) return val;
  return new Date(val);
}

function matchesWhere(row: any, where: any, db: InMemoryDatabase): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === 'OR' && Array.isArray(cond)) {
      if (!cond.some((sub) => matchesWhere(row, sub, db))) return false;
      continue;
    }
    if (key === 'AND' && Array.isArray(cond)) {
      if (!cond.every((sub) => matchesWhere(row, sub, db))) return false;
      continue;
    }
    if (key === 'members' && typeof cond === 'object' && cond !== null && 'some' in cond) {
      const someCond = (cond as any).some;
      const members = db.projectMembers.filter((m) => m.projectId === row.id);
      if (!members.some((m) => matchesWhere(m, someCond, db))) return false;
      continue;
    }
    if (key === 'project' && typeof cond === 'object' && cond !== null) {
      const proj = db.projects.find((p) => p.id === row.projectId);
      if (!proj || !matchesWhere(proj, cond, db)) return false;
      continue;
    }
    if (key === 'allocations' && typeof cond === 'object' && cond !== null && 'some' in cond) {
      const someCond = (cond as any).some;
      const allocs = db.paymentAllocations.filter((a) => a.paymentId === row.id);
      if (!allocs.some((a) => matchesWhere(a, someCond, db))) return false;
      continue;
    }

    const val = row[key];
    if (
      cond !== null &&
      typeof cond === 'object' &&
      !(cond instanceof Date) &&
      !(cond instanceof Prisma.Decimal)
    ) {
      const c = cond as any;
      if ('contains' in c) {
        const needle = String(c.contains).toLowerCase();
        const hay = String(val ?? '').toLowerCase();
        if (!hay.includes(needle)) return false;
        continue;
      }
      if ('in' in c && Array.isArray(c.in)) {
        if (!c.in.includes(val)) return false;
        continue;
      }
      if ('not' in c) {
        if (val === c.not) return false;
        continue;
      }
      if ('gt' in c) {
        if (!(val > c.gt)) return false;
      }
      if ('gte' in c) {
        if (!(val >= c.gte)) return false;
      }
      if ('lt' in c) {
        if (!(val < c.lt)) return false;
      }
      if ('lte' in c) {
        if (!(val <= c.lte)) return false;
      }
      continue;
    }

    if (val instanceof Date && cond instanceof Date) {
      if (val.getTime() !== cond.getTime()) return false;
    } else if (val !== cond) {
      return false;
    }
  }
  return true;
}

function sortRows(rows: any[], orderBy: any): any[] {
  if (!orderBy) return rows;
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const ord of orders) {
      const [field, dir] = Object.entries(ord)[0] as [string, 'asc' | 'desc'];
      const va = a[field];
      const vb = b[field];
      const na = va instanceof Prisma.Decimal ? va.toNumber() : va instanceof Date ? va.getTime() : va;
      const nb = vb instanceof Prisma.Decimal ? vb.toNumber() : vb instanceof Date ? vb.getTime() : vb;
      if (na < nb) return dir === 'asc' ? -1 : 1;
      if (na > nb) return dir === 'asc' ? 1 : -1;
    }
    return 0;
  });
}

export class InMemoryDatabase {
  users: any[] = [];
  refreshTokens: any[] = [];
  loginAttempts: any[] = [];
  companies: any[] = [];
  taxRates: any[] = [];
  documentSequences: any[] = [];
  clients: any[] = [];
  projects: any[] = [];
  projectMembers: any[] = [];
  userCompanies: any[] = [];
  files: any[] = [];
  auditLogs: any[] = [];
  quotations: any[] = [];
  quotationSections: any[] = [];
  quotationItems: any[] = [];
  contractItems: any[] = [];
  variationOrders: any[] = [];
  variationOrderItems: any[] = [];
  invoices: any[] = [];
  invoiceLines: any[] = [];
  claimLines: any[] = [];
  creditNotes: any[] = [];
  payments: any[] = [];
  paymentAllocations: any[] = [];
  dailyReports: any[] = [];
  dailyReportManpower: any[] = [];
  dailyReportPhotos: any[] = [];
  dailyReportProgress: any[] = [];
  progressReports: any[] = [];
  progressReportLines: any[] = [];
  inspectionReports: any[] = [];
  expenses: any[] = [];

  private lockPromise: Promise<void> = Promise.resolve();
  private persistFilePath?: string;
  private isLoadingFromDisk = false;
  private normalizers = new Map<
    string,
    { get: () => any[]; set: (r: any[]) => void; defaults: (d: any) => any }
  >();

  constructor(persistFilePath?: string) {
    this.persistFilePath = persistFilePath;
  }

  private saveToDisk() {
    if (!this.persistFilePath || this.isLoadingFromDisk) return;
    try {
      const dir = path.dirname(this.persistFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const snapshot: Record<string, any[]> = {};
      for (const [tableName, meta] of this.normalizers.entries()) {
        snapshot[tableName] = meta.get();
      }
      fs.writeFileSync(this.persistFilePath, JSON.stringify(snapshot, null, 2), 'utf8');
    } catch (err) {
      console.warn('[InMemoryDatabase] Failed to save snapshot to disk:', err);
    }
  }

  public loadFromDisk() {
    if (!this.persistFilePath || !fs.existsSync(this.persistFilePath)) return;
    this.isLoadingFromDisk = true;
    try {
      const raw = fs.readFileSync(this.persistFilePath, 'utf8');
      const parsed = JSON.parse(raw);
      for (const [tableName, meta] of this.normalizers.entries()) {
        if (Array.isArray(parsed[tableName])) {
          meta.set(parsed[tableName].map((row: any) => meta.defaults(row)));
        }
      }
    } catch (err) {
      console.warn('[InMemoryDatabase] Failed to load snapshot from disk:', err);
    } finally {
      this.isLoadingFromDisk = false;
    }
  }

  reset() {
    this.users = [];
    this.refreshTokens = [];
    this.loginAttempts = [];
    this.companies = [];
    this.taxRates = [];
    this.documentSequences = [];
    this.clients = [];
    this.projects = [];
    this.projectMembers = [];
    this.userCompanies = [];
    this.files = [];
    this.auditLogs = [];
    this.quotations = [];
    this.quotationSections = [];
    this.quotationItems = [];
    this.contractItems = [];
    this.variationOrders = [];
    this.variationOrderItems = [];
    this.invoices = [];
    this.invoiceLines = [];
    this.claimLines = [];
    this.creditNotes = [];
    this.payments = [];
    this.paymentAllocations = [];
    this.dailyReports = [];
    this.dailyReportManpower = [];
    this.dailyReportPhotos = [];
    this.dailyReportProgress = [];
    this.progressReports = [];
    this.progressReportLines = [];
    this.inspectionReports = [];
    this.expenses = [];
  }

  async runLocked<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const prev = this.lockPromise;
    this.lockPromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private hydrateRelations(tableName: string, row: any, include?: any): any {
    if (!row) return null;
    const copy = { ...row };
    if (!include) return copy;

    if (tableName === 'project') {
      if (include.client) {
        copy.client = this.clients.find((c) => c.id === row.clientId) || null;
      }
      if (include.company) {
        copy.company = row.companyId
          ? this.companies.find((c) => c.id === row.companyId) || null
          : null;
      }
      if (include.members) {
        const mems = this.projectMembers.filter((m) => m.projectId === row.id);
        copy.members = mems.map((m) => ({
          ...m,
          user: this.users.find((u) => u.id === m.userId) || null,
        }));
      }
    } else if (tableName === 'user') {
      if (include.company) {
        copy.company = row.companyId
          ? this.companies.find((c) => c.id === row.companyId) || null
          : null;
      }
      if (include.companies) {
        const ucs = this.userCompanies.filter((uc) => uc.userId === row.id);
        copy.companies = ucs.map((uc) => ({
          ...uc,
          company: this.companies.find((c) => c.id === uc.companyId) || null,
        }));
      }
      if (include.memberships) {
        const mems = this.projectMembers.filter((m) => m.userId === row.id);
        copy.memberships = mems.map((m) => ({
          ...m,
          project: this.projects.find((p) => p.id === m.projectId) || null,
        }));
      }
    } else if (tableName === 'userCompany') {
      if (include.user) {
        copy.user = this.users.find((u) => u.id === row.userId) || null;
      }
      if (include.company) {
        copy.company = this.companies.find((c) => c.id === row.companyId) || null;
      }
    } else if (tableName === 'projectMember') {
      if (include.user) {
        copy.user = this.users.find((u) => u.id === row.userId) || null;
      }
      if (include.project) {
        copy.project = this.projects.find((p) => p.id === row.projectId) || null;
      }
    } else if (tableName === 'refreshToken') {
      if (include.user) {
        copy.user = this.users.find((u) => u.id === row.userId) || null;
      }
    } else if (tableName === 'quotation') {
      if (include.client) {
        copy.client = this.clients.find((c) => c.id === row.clientId) || null;
      }
      if (include.company) {
        copy.company = row.companyId
          ? this.companies.find((c) => c.id === row.companyId) || null
          : null;
      }
      if (include.project) {
        copy.project = row.projectId
          ? this.projects.find((p) => p.id === row.projectId) || null
          : null;
      }
      if (include.createdBy) {
        copy.createdBy = this.users.find((u) => u.id === row.createdById) || null;
      }
      if (include.sections) {
        const secs = sortRows(
          this.quotationSections.filter((s) => s.quotationId === row.id),
          { sortOrder: 'asc' },
        );
        copy.sections = secs.map((s) => ({
          ...s,
          items: sortRows(
            this.quotationItems.filter((i) => i.sectionId === s.id),
            { sortOrder: 'asc' },
          ),
        }));
      }
      if (include.items) {
        copy.items = sortRows(
          this.quotationItems.filter((i) => i.quotationId === row.id),
          { sortOrder: 'asc' },
        );
      }
    } else if (tableName === 'variationOrder') {
      if (include.project) {
        copy.project = this.projects.find((p) => p.id === row.projectId) || null;
      }
      if (include.items) {
        copy.items = sortRows(
          this.variationOrderItems.filter((i) => i.variationOrderId === row.id),
          { sortOrder: 'asc' },
        );
      }
    } else if (tableName === 'invoice') {
      if (include.client) {
        copy.client = this.clients.find((c) => c.id === row.clientId) || null;
      }
      if (include.company) {
        copy.company = row.companyId
          ? this.companies.find((c) => c.id === row.companyId) || null
          : null;
      }
      if (include.project) {
        copy.project = row.projectId
          ? this.projects.find((p) => p.id === row.projectId) || null
          : null;
      }
      if (include.progressReport) {
        copy.progressReport = row.progressReportId
          ? this.progressReports.find((pr) => pr.id === row.progressReportId) || null
          : null;
      }
      if (include.lines) {
        copy.lines = sortRows(
          this.invoiceLines.filter((l) => l.invoiceId === row.id),
          { sortOrder: 'asc' },
        );
      }
      if (include.claimLines) {
        const cLines = this.claimLines.filter((cl) => cl.invoiceId === row.id);
        copy.claimLines = cLines.map((cl) => ({
          ...cl,
          contractItem: this.contractItems.find((ci) => ci.id === cl.contractItemId) || null,
        }));
      }
      if (include.creditNotes) {
        copy.creditNotes = sortRows(
          this.creditNotes.filter((cn) => cn.invoiceId === row.id),
          { createdAt: 'asc' },
        );
      }
      if (include.allocations) {
        copy.allocations = this.paymentAllocations.filter((a) => a.invoiceId === row.id);
      }
    } else if (tableName === 'payment') {
      if (include.client) {
        copy.client = this.clients.find((c) => c.id === row.clientId) || null;
      }
      if (include.allocations) {
        const allocs = this.paymentAllocations.filter((a) => a.paymentId === row.id);
        copy.allocations = allocs.map((a) => ({
          ...a,
          invoice: this.invoices.find((inv) => inv.id === a.invoiceId) || null,
        }));
      }
    } else if (tableName === 'dailyReport') {
      if (include.project) {
        copy.project = this.projects.find((p) => p.id === row.projectId) || null;
      }
      if (include.submittedBy) {
        copy.submittedBy = this.users.find((u) => u.id === row.submittedById) || null;
      }
      if (include.reviewedBy) {
        copy.reviewedBy = row.reviewedById
          ? this.users.find((u) => u.id === row.reviewedById) || null
          : null;
      }
      if (include.manpower) {
        copy.manpower = this.dailyReportManpower.filter((m) => m.dailyReportId === row.id);
      }
      if (include.photos) {
        const photos = sortRows(
          this.dailyReportPhotos.filter((p) => p.dailyReportId === row.id),
          { sortOrder: 'asc' },
        );
        copy.photos = photos.map((p) => ({
          ...p,
          file: this.files.find((f) => f.id === p.fileId) || null,
        }));
      }
      if (include.progress) {
        copy.progress = this.dailyReportProgress.filter((pr) => pr.dailyReportId === row.id);
      }
    } else if (tableName === 'progressReport') {
      if (include.project) {
        copy.project = this.projects.find((p) => p.id === row.projectId) || null;
      }
      if (include.createdBy) {
        copy.createdBy = this.users.find((u) => u.id === row.createdById) || null;
      }
      if (include.lines) {
        copy.lines = this.progressReportLines
          .filter((l) => l.progressReportId === row.id)
          .map((l) => ({
            ...l,
            contractItem: this.contractItems.find((ci) => ci.id === l.contractItemId) || null,
          }));
      }
    } else if (tableName === 'inspectionReport') {
      if (include.project) {
        copy.project = this.projects.find((p) => p.id === row.projectId) || null;
      }
      if (include.inspector) {
        copy.inspector = this.users.find((u) => u.id === row.inspectorId) || null;
      }
    } else if (tableName === 'expense') {
      if (include.company) {
        copy.company = row.companyId
          ? this.companies.find((c) => c.id === row.companyId) || null
          : null;
      }
      if (include.project) {
        copy.project = row.projectId
          ? this.projects.find((p) => p.id === row.projectId) || null
          : null;
      }
      if (include.taxRate) {
        copy.taxRate = row.taxRateId
          ? this.taxRates.find((t) => t.id === row.taxRateId) || null
          : null;
      }
      if (include.receiptFile) {
        copy.receiptFile = row.receiptFileId
          ? this.files.find((f) => f.id === row.receiptFileId) || null
          : null;
      }
      if (include.createdBy) {
        copy.createdBy = this.users.find((u) => u.id === row.createdById) || null;
      }
    }
    return copy;
  }

  createModelDelegate(
    tableName: string,
    getCollection: () => any[],
    setCollection: (rows: any[]) => void,
    defaults: (data: any) => any,
    onCascadeDelete?: (deletedRow: any) => void,
  ) {
    const db = this;
    this.normalizers.set(tableName, { get: getCollection, set: setCollection, defaults });

    const matchUnique = (row: any, where: any): boolean => {
      if (!where) return false;
      for (const [k, v] of Object.entries(where)) {
        if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
          for (const [subK, subV] of Object.entries(v as any)) {
            if (row[subK] instanceof Date && subV instanceof Date) {
              if (row[subK].getTime() !== subV.getTime()) return false;
            } else if (row[subK] !== subV) {
              return false;
            }
          }
        } else if (row[k] instanceof Date && v instanceof Date) {
          if (row[k].getTime() !== v.getTime()) return false;
        } else if (row[k] !== v) {
          return false;
        }
      }
      return true;
    };

    return {
      findUnique: async ({ where, include }: any) => {
        const found = getCollection().find((r) => matchUnique(r, where));
        return db.hydrateRelations(tableName, found || null, include);
      },
      findFirst: async ({ where, orderBy, include }: any = {}) => {
        const filtered = getCollection().filter((r) => matchesWhere(r, where, db));
        const sorted = sortRows(filtered, orderBy);
        return db.hydrateRelations(tableName, sorted[0] || null, include);
      },
      findMany: async ({ where, orderBy, skip, take, include }: any = {}) => {
        const filtered = getCollection().filter((r) => matchesWhere(r, where, db));
        let sorted = sortRows(filtered, orderBy);
        if (typeof skip === 'number') sorted = sorted.slice(skip);
        if (typeof take === 'number') sorted = sorted.slice(0, take);
        return sorted.map((r) => db.hydrateRelations(tableName, r, include));
      },
      count: async ({ where }: any = {}) => {
        return getCollection().filter((r) => matchesWhere(r, where, db)).length;
      },
      create: async ({ data, include }: any) => {
        const row = defaults(data);
        getCollection().push(row);
        db.saveToDisk();
        return db.hydrateRelations(tableName, row, include);
      },
      createMany: async ({ data }: any) => {
        const rows = (data as any[]).map((d) => defaults(d));
        getCollection().push(...rows);
        db.saveToDisk();
        return { count: rows.length };
      },
      update: async ({ where, data, include }: any) => {
        const coll = getCollection();
        const idx = coll.findIndex((r) => matchUnique(r, where));
        if (idx === -1) {
          throw new Error(`Record not found in ${tableName}`);
        }
        const existing = coll[idx];
        const updated = defaults({
          ...existing,
          ...Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined)),
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: new Date(),
        });
        coll[idx] = updated;
        db.saveToDisk();
        return db.hydrateRelations(tableName, updated, include);
      },
      updateMany: async ({ where, data }: any) => {
        const coll = getCollection();
        let count = 0;
        for (let i = 0; i < coll.length; i++) {
          if (matchesWhere(coll[i], where, db)) {
            coll[i] = defaults({
              ...coll[i],
              ...Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined)),
              id: coll[i].id,
              createdAt: coll[i].createdAt,
              updatedAt: new Date(),
            });
            count++;
          }
        }
        if (count > 0) db.saveToDisk();
        return { count };
      },
      upsert: async ({ where, update, create, include }: any) => {
        const coll = getCollection();
        const idx = coll.findIndex((r) => matchUnique(r, where));
        if (idx !== -1) {
          const existing = coll[idx];
          const updated = defaults({
            ...existing,
            ...Object.fromEntries(Object.entries(update).filter(([_, v]) => v !== undefined)),
            id: existing.id,
            createdAt: existing.createdAt,
            updatedAt: new Date(),
          });
          coll[idx] = updated;
          db.saveToDisk();
          return db.hydrateRelations(tableName, updated, include);
        }
        const row = defaults(create);
        coll.push(row);
        db.saveToDisk();
        return db.hydrateRelations(tableName, row, include);
      },
      delete: async ({ where }: any) => {
        const coll = getCollection();
        const idx = coll.findIndex((r) => matchUnique(r, where));
        if (idx === -1) throw new Error(`Record not found in ${tableName}`);
        const [removed] = coll.splice(idx, 1);
        onCascadeDelete?.(removed);
        db.saveToDisk();
        return removed;
      },
      deleteMany: async ({ where }: any = {}) => {
        const coll = getCollection();
        const toDelete = coll.filter((r) => matchesWhere(r, where, db));
        setCollection(coll.filter((r) => !matchesWhere(r, where, db)));
        toDelete.forEach((r) => onCascadeDelete?.(r));
        if (toDelete.length > 0) db.saveToDisk();
        return { count: toDelete.length };
      },
    };
  }

  getClient(): any {
    const db = this;
    const now = () => new Date();

    const client: any = {
      user: this.createModelDelegate(
        'user',
        () => db.users,
        (r) => (db.users = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          email: d.email,
          passwordHash: d.passwordHash,
          name: d.name,
          phone: d.phone ?? null,
          role: d.role,
          companyId: d.companyId ?? null,
          companyName: d.companyName ?? null,
          isActive: d.isActive ?? true,
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
        (u) => {
          db.refreshTokens = db.refreshTokens.filter((t) => t.userId !== u.id);
          db.projectMembers = db.projectMembers.filter((m) => m.userId !== u.id);
          db.userCompanies = db.userCompanies.filter((uc) => uc.userId !== u.id);
        },
      ),
      userCompany: this.createModelDelegate(
        'userCompany',
        () => db.userCompanies,
        (r) => (db.userCompanies = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          userId: d.userId,
          companyId: d.companyId,
          createdAt: d.createdAt ?? now(),
        }),
      ),
      refreshToken: this.createModelDelegate(
        'refreshToken',
        () => db.refreshTokens,
        (r) => (db.refreshTokens = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          userId: d.userId,
          tokenHash: d.tokenHash,
          deviceName: d.deviceName ?? null,
          expiresAt: toDate(d.expiresAt),
          revokedAt: d.revokedAt ? toDate(d.revokedAt) : null,
          createdAt: d.createdAt ?? now(),
        }),
      ),
      loginAttempt: this.createModelDelegate(
        'loginAttempt',
        () => db.loginAttempts,
        (r) => (db.loginAttempts = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          email: d.email,
          success: Boolean(d.success),
          ip: d.ip ?? null,
          createdAt: d.createdAt ?? now(),
        }),
      ),
      company: this.createModelDelegate(
        'company',
        () => db.companies,
        (r) => (db.companies = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          singleton: d.singleton !== undefined ? d.singleton : null,
          code: d.code ?? null,
          name: d.name,
          registrationNo: d.registrationNo ?? null,
          tin: d.tin ?? null,
          sstNo: d.sstNo ?? null,
          msicCode: d.msicCode ?? null,
          address: d.address ?? null,
          phone: d.phone ?? null,
          email: d.email ?? null,
          logoFileId: d.logoFileId ?? null,
          bankDetails: d.bankDetails ?? null,
          defaultPaymentTermDays: d.defaultPaymentTermDays ?? 30,
          defaultRetentionPercent: toDecimal(d.defaultRetentionPercent ?? 10),
          defaultRetentionCapPercent: toDecimal(d.defaultRetentionCapPercent ?? 5),
          isDefault: d.isDefault ?? false,
          isActive: d.isActive ?? true,
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
      ),
      taxRate: this.createModelDelegate(
        'taxRate',
        () => db.taxRates,
        (r) => (db.taxRates = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          name: d.name,
          percent: toDecimal(d.percent),
          isDefault: d.isDefault ?? false,
          isActive: d.isActive ?? true,
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
      ),
      documentSequence: this.createModelDelegate(
        'documentSequence',
        () => db.documentSequences,
        (r) => (db.documentSequences = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          docType: d.docType,
          year: Number(d.year),
          lastNumber: Number(d.lastNumber ?? 0),
          updatedAt: d.updatedAt ?? now(),
        }),
      ),
      client: this.createModelDelegate(
        'client',
        () => db.clients,
        (r) => (db.clients = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          code: d.code ?? null,
          name: d.name,
          registrationNo: d.registrationNo ?? null,
          tin: d.tin ?? null,
          sstNo: d.sstNo ?? null,
          address: d.address ?? null,
          contactName: d.contactName ?? null,
          phone: d.phone ?? null,
          email: d.email ?? null,
          isActive: d.isActive ?? true,
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
      ),
      project: this.createModelDelegate(
        'project',
        () => db.projects,
        (r) => (db.projects = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          code: d.code,
          name: d.name,
          clientId: d.clientId,
          companyId: d.companyId ?? null,
          contractQuotationId: d.contractQuotationId ?? null,
          contractQuoteRef: d.contractQuoteRef ?? null,
          poNumber: d.poNumber ?? null,
          siteAddress: d.siteAddress ?? null,
          status: d.status ?? 'DRAFT',
          startDate: d.startDate ? toDate(d.startDate) : null,
          endDate: d.endDate ? toDate(d.endDate) : null,
          contractSum: toDecimal(d.contractSum ?? 0),
          retentionPercent: toDecimal(d.retentionPercent ?? 10),
          retentionCapPercent: toDecimal(d.retentionCapPercent ?? 5),
          defectsLiabilityMonths: d.defectsLiabilityMonths ?? 12,
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
        (p) => {
          db.projectMembers = db.projectMembers.filter((m) => m.projectId !== p.id);
        },
      ),
      projectMember: this.createModelDelegate(
        'projectMember',
        () => db.projectMembers,
        (r) => (db.projectMembers = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          projectId: d.projectId,
          userId: d.userId,
          createdAt: d.createdAt ?? now(),
        }),
      ),
      file: this.createModelDelegate(
        'file',
        () => db.files,
        (r) => (db.files = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          bucketKey: d.bucketKey,
          fileName: d.fileName,
          mimeType: d.mimeType,
          size: Number(d.size),
          purpose: d.purpose,
          status: d.status ?? 'PENDING',
          uploadedById: d.uploadedById,
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
      ),
      auditLog: this.createModelDelegate(
        'auditLog',
        () => db.auditLogs,
        (r) => (db.auditLogs = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          userId: d.userId ?? null,
          entity: d.entity,
          entityId: d.entityId,
          action: d.action,
          before: d.before ?? null,
          after: d.after ?? null,
          at: d.at ?? now(),
        }),
      ),
      quotation: this.createModelDelegate(
        'quotation',
        () => db.quotations,
        (r) => (db.quotations = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          number: d.number,
          rootId: d.rootId,
          revisionNo: Number(d.revisionNo ?? 0),
          clientId: d.clientId,
          companyId: d.companyId ?? null,
          projectId: d.projectId ?? null,
          title: d.title,
          status: d.status ?? 'DRAFT',
          issueDate: toDate(d.issueDate ?? now()),
          validUntil: d.validUntil ? toDate(d.validUntil) : null,
          terms: d.terms ?? null,
          notes: d.notes ?? null,
          rejectionReason: d.rejectionReason ?? null,
          subtotal: toDecimal(d.subtotal ?? 0),
          discountAmount: toDecimal(d.discountAmount ?? 0),
          taxAmount: toDecimal(d.taxAmount ?? 0),
          total: toDecimal(d.total ?? 0),
          pdfFileId: d.pdfFileId ?? null,
          createdById: d.createdById,
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
        (q) => {
          db.quotationSections = db.quotationSections.filter((s) => s.quotationId !== q.id);
          db.quotationItems = db.quotationItems.filter((i) => i.quotationId !== q.id);
        },
      ),
      quotationSection: this.createModelDelegate(
        'quotationSection',
        () => db.quotationSections,
        (r) => (db.quotationSections = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          quotationId: d.quotationId,
          sortOrder: Number(d.sortOrder ?? 0),
          title: d.title,
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
        (s) => {
          db.quotationItems = db.quotationItems.filter((i) => i.sectionId !== s.id);
        },
      ),
      quotationItem: this.createModelDelegate(
        'quotationItem',
        () => db.quotationItems,
        (r) => (db.quotationItems = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          quotationId: d.quotationId,
          sectionId: d.sectionId,
          sortOrder: Number(d.sortOrder ?? 0),
          description: d.description,
          unit: d.unit ?? null,
          quantity: toDecimal(d.quantity),
          rate: toDecimal(d.rate),
          amount: toDecimal(d.amount),
          taxRateId: d.taxRateId ?? null,
          taxPercent: toDecimal(d.taxPercent ?? 0),
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
      ),
      contractItem: this.createModelDelegate(
        'contractItem',
        () => db.contractItems,
        (r) => (db.contractItems = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          projectId: d.projectId,
          sourceQuotationItemId: d.sourceQuotationItemId ?? null,
          variationOrderId: d.variationOrderId ?? null,
          sectionTitle: d.sectionTitle ?? null,
          sortOrder: Number(d.sortOrder ?? 0),
          description: d.description,
          unit: d.unit ?? null,
          quantity: toDecimal(d.quantity),
          rate: toDecimal(d.rate),
          amount: toDecimal(d.amount),
          taxPercent: toDecimal(d.taxPercent ?? 0),
          createdById: d.createdById,
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
      ),
      variationOrder: this.createModelDelegate(
        'variationOrder',
        () => db.variationOrders,
        (r) => (db.variationOrders = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          number: d.number,
          shortRef: d.shortRef ?? null,
          projectId: d.projectId,
          title: d.title,
          reason: d.reason ?? null,
          status: d.status ?? 'DRAFT',
          approvedAt: d.approvedAt ? toDate(d.approvedAt) : null,
          total: toDecimal(d.total ?? 0),
          createdById: d.createdById,
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
        (vo) => {
          db.variationOrderItems = db.variationOrderItems.filter(
            (i) => i.variationOrderId !== vo.id,
          );
        },
      ),
      variationOrderItem: this.createModelDelegate(
        'variationOrderItem',
        () => db.variationOrderItems,
        (r) => (db.variationOrderItems = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          variationOrderId: d.variationOrderId,
          sortOrder: Number(d.sortOrder ?? 0),
          description: d.description,
          unit: d.unit ?? null,
          quantity: toDecimal(d.quantity),
          rate: toDecimal(d.rate),
          amount: toDecimal(d.amount),
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
      ),
      invoice: this.createModelDelegate(
        'invoice',
        () => db.invoices,
        (r) => (db.invoices = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          number: d.number ?? null,
          type: d.type,
          companyId: d.companyId ?? null,
          projectId: d.projectId ?? null,
          clientId: d.clientId,
          status: d.status ?? 'DRAFT',
          issueDate: d.issueDate ? toDate(d.issueDate) : null,
          dueDate: d.dueDate ? toDate(d.dueDate) : null,
          claimNo: d.claimNo !== undefined && d.claimNo !== null ? Number(d.claimNo) : null,
          progressReportId: d.progressReportId ?? null,
          projectCodeRef: d.projectCodeRef ?? null,
          quotePoRef: d.quotePoRef ?? null,
          claimReportRef: d.claimReportRef ?? null,
          referenceSummary: d.referenceSummary ?? null,
          periodFrom: d.periodFrom ? toDate(d.periodFrom) : null,
          periodTo: d.periodTo ? toDate(d.periodTo) : null,
          grossToDate:
            d.grossToDate !== undefined && d.grossToDate !== null
              ? toDecimal(d.grossToDate)
              : null,
          retentionToDate:
            d.retentionToDate !== undefined && d.retentionToDate !== null
              ? toDecimal(d.retentionToDate)
              : null,
          previousNetCertified:
            d.previousNetCertified !== undefined && d.previousNetCertified !== null
              ? toDecimal(d.previousNetCertified)
              : null,
          taxPercent:
            d.taxPercent !== undefined && d.taxPercent !== null ? toDecimal(d.taxPercent) : null,
          subtotal: toDecimal(d.subtotal ?? 0),
          taxAmount: toDecimal(d.taxAmount ?? 0),
          total: toDecimal(d.total ?? 0),
          amountPaid: toDecimal(d.amountPaid ?? 0),
          notes: d.notes ?? null,
          pdfFileId: d.pdfFileId ?? null,
          voidedAt: d.voidedAt ? toDate(d.voidedAt) : null,
          voidReason: d.voidReason ?? null,
          buyerName: d.buyerName ?? null,
          buyerRegistrationNo: d.buyerRegistrationNo ?? null,
          buyerTin: d.buyerTin ?? null,
          buyerSstNo: d.buyerSstNo ?? null,
          buyerAddress: d.buyerAddress ?? null,
          supplierName: d.supplierName ?? null,
          supplierRegistrationNo: d.supplierRegistrationNo ?? null,
          supplierTin: d.supplierTin ?? null,
          supplierSstNo: d.supplierSstNo ?? null,
          supplierMsicCode: d.supplierMsicCode ?? null,
          supplierAddress: d.supplierAddress ?? null,
          eInvoiceStatus: d.eInvoiceStatus ?? 'NOT_REQUIRED',
          eInvoiceUuid: d.eInvoiceUuid ?? null,
          eInvoiceLongId: d.eInvoiceLongId ?? null,
          eInvoiceValidatedAt: d.eInvoiceValidatedAt ? toDate(d.eInvoiceValidatedAt) : null,
          createdById: d.createdById,
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
        (inv) => {
          db.invoiceLines = db.invoiceLines.filter((l) => l.invoiceId !== inv.id);
          db.claimLines = db.claimLines.filter((cl) => cl.invoiceId !== inv.id);
        },
      ),
      invoiceLine: this.createModelDelegate(
        'invoiceLine',
        () => db.invoiceLines,
        (r) => (db.invoiceLines = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          invoiceId: d.invoiceId,
          sortOrder: Number(d.sortOrder ?? 0),
          description: d.description,
          unit: d.unit ?? null,
          quantity: toDecimal(d.quantity),
          rate: toDecimal(d.rate),
          amount: toDecimal(d.amount),
          taxPercent: toDecimal(d.taxPercent ?? 0),
          taxAmount: toDecimal(d.taxAmount ?? 0),
          classificationCode: d.classificationCode ?? null,
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
      ),
      claimLine: this.createModelDelegate(
        'claimLine',
        () => db.claimLines,
        (r) => (db.claimLines = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          invoiceId: d.invoiceId,
          contractItemId: d.contractItemId,
          cumulativePercent: toDecimal(d.cumulativePercent ?? 0),
          cumulativeQuantity: toDecimal(d.cumulativeQuantity ?? 0),
          cumulativeAmount: toDecimal(d.cumulativeAmount ?? 0),
          previousAmount: toDecimal(d.previousAmount ?? 0),
          thisClaimAmount: toDecimal(d.thisClaimAmount ?? 0),
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
      ),
      creditNote: this.createModelDelegate(
        'creditNote',
        () => db.creditNotes,
        (r) => (db.creditNotes = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          number: d.number,
          invoiceId: d.invoiceId,
          issueDate: toDate(d.issueDate),
          reason: d.reason,
          subtotal: toDecimal(d.subtotal),
          taxAmount: toDecimal(d.taxAmount ?? 0),
          total: toDecimal(d.total),
          pdfFileId: d.pdfFileId ?? null,
          eInvoiceStatus: d.eInvoiceStatus ?? 'NOT_REQUIRED',
          eInvoiceUuid: d.eInvoiceUuid ?? null,
          eInvoiceLongId: d.eInvoiceLongId ?? null,
          eInvoiceValidatedAt: d.eInvoiceValidatedAt ? toDate(d.eInvoiceValidatedAt) : null,
          createdById: d.createdById,
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
      ),
      payment: this.createModelDelegate(
        'payment',
        () => db.payments,
        (r) => (db.payments = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          clientId: d.clientId,
          receivedDate: toDate(d.receivedDate),
          method: d.method,
          reference: d.reference ?? null,
          amount: toDecimal(d.amount),
          notes: d.notes ?? null,
          createdById: d.createdById,
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
        (p) => {
          db.paymentAllocations = db.paymentAllocations.filter((a) => a.paymentId !== p.id);
        },
      ),
      paymentAllocation: this.createModelDelegate(
        'paymentAllocation',
        () => db.paymentAllocations,
        (r) => (db.paymentAllocations = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          paymentId: d.paymentId,
          invoiceId: d.invoiceId,
          amount: toDecimal(d.amount),
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
      ),
      dailyReport: this.createModelDelegate(
        'dailyReport',
        () => db.dailyReports,
        (r) => (db.dailyReports = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          number: d.number ?? null,
          projectId: d.projectId,
          reportDate: toDate(d.reportDate),
          submittedById: d.submittedById,
          weather: d.weather ?? null,
          workDone: d.workDone,
          issues: d.issues ?? null,
          nextDayPlan: d.nextDayPlan ?? null,
          status: d.status ?? 'SUBMITTED',
          reviewedById: d.reviewedById ?? null,
          reviewedAt: d.reviewedAt ? toDate(d.reviewedAt) : null,
          latitude: d.latitude !== undefined && d.latitude !== null ? toDecimal(d.latitude) : null,
          longitude:
            d.longitude !== undefined && d.longitude !== null ? toDecimal(d.longitude) : null,
          deviceCreatedAt: d.deviceCreatedAt ? toDate(d.deviceCreatedAt) : null,
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
        (dr) => {
          db.dailyReportManpower = db.dailyReportManpower.filter((m) => m.dailyReportId !== dr.id);
          db.dailyReportPhotos = db.dailyReportPhotos.filter((p) => p.dailyReportId !== dr.id);
          db.dailyReportProgress = db.dailyReportProgress.filter((pr) => pr.dailyReportId !== dr.id);
        },
      ),
      dailyReportManpower: this.createModelDelegate(
        'dailyReportManpower',
        () => db.dailyReportManpower,
        (r) => (db.dailyReportManpower = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          dailyReportId: d.dailyReportId,
          trade: d.trade,
          headcount: Number(d.headcount),
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
      ),
      dailyReportPhoto: this.createModelDelegate(
        'dailyReportPhoto',
        () => db.dailyReportPhotos,
        (r) => (db.dailyReportPhotos = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          dailyReportId: d.dailyReportId,
          fileId: d.fileId,
          caption: d.caption ?? null,
          takenAt: d.takenAt ? toDate(d.takenAt) : null,
          sortOrder: Number(d.sortOrder ?? 0),
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
      ),
      dailyReportProgress: this.createModelDelegate(
        'dailyReportProgress',
        () => db.dailyReportProgress,
        (r) => (db.dailyReportProgress = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          dailyReportId: d.dailyReportId,
          contractItemId: d.contractItemId,
          percentComplete: toDecimal(d.percentComplete),
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
      ),
      progressReport: this.createModelDelegate(
        'progressReport',
        () => db.progressReports,
        (r) => (db.progressReports = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          number: d.number,
          projectId: d.projectId,
          reportDate: toDate(d.reportDate),
          periodFrom: d.periodFrom ? toDate(d.periodFrom) : null,
          periodTo: d.periodTo ? toDate(d.periodTo) : null,
          summary: d.summary ?? null,
          overallPercent: toDecimal(d.overallPercent ?? 0),
          createdById: d.createdById,
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
        (pr) => {
          db.progressReportLines = db.progressReportLines.filter(
            (l) => l.progressReportId !== pr.id,
          );
        },
      ),
      progressReportLine: this.createModelDelegate(
        'progressReportLine',
        () => db.progressReportLines,
        (r) => (db.progressReportLines = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          progressReportId: d.progressReportId,
          contractItemId: d.contractItemId,
          cumulativePercent: toDecimal(d.cumulativePercent ?? 0),
          notes: d.notes ?? null,
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
      ),
      inspectionReport: this.createModelDelegate(
        'inspectionReport',
        () => db.inspectionReports,
        (r) => (db.inspectionReports = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          number: d.number,
          projectId: d.projectId,
          inspectionDate: toDate(d.inspectionDate),
          title: d.title,
          findings: d.findings ?? null,
          status: d.status ?? 'PASSED',
          inspectorId: d.inspectorId,
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
      ),
      expense: this.createModelDelegate(
        'expense',
        () => db.expenses,
        (r) => (db.expenses = r),
        (d) => ({
          id: d.id ?? uuidv7(),
          number: d.number,
          companyId: d.companyId ?? null,
          projectId: d.projectId ?? null,
          projectCodeRef: d.projectCodeRef ?? null,
          category: d.category,
          status: d.status ?? 'UNPAID',
          expenseDate: toDate(d.expenseDate),
          vendorName: d.vendorName,
          billReference: d.billReference ?? null,
          description: d.description,
          subtotal: toDecimal(d.subtotal ?? 0),
          taxRateId: d.taxRateId ?? null,
          taxPercent: toDecimal(d.taxPercent ?? 0),
          taxAmount: toDecimal(d.taxAmount ?? 0),
          total: toDecimal(d.total ?? 0),
          paidDate: d.paidDate ? toDate(d.paidDate) : null,
          paymentMethod: d.paymentMethod ?? null,
          paymentReference: d.paymentReference ?? null,
          receiptFileId: d.receiptFileId ?? null,
          notes: d.notes ?? null,
          voidedAt: d.voidedAt ? toDate(d.voidedAt) : null,
          voidReason: d.voidReason ?? null,
          createdById: d.createdById,
          createdAt: d.createdAt ?? now(),
          updatedAt: d.updatedAt ?? now(),
        }),
      ),
      $transaction: async (arg: any) => {
        if (typeof arg === 'function') {
          return db.runLocked(() => arg(client));
        }
        if (Array.isArray(arg)) {
          return db.runLocked(() => Promise.all(arg));
        }
        throw new Error('Unsupported $transaction argument');
      },
      $connect: async () => {},
      $disconnect: async () => {},
    };

    return client;
  }
}
