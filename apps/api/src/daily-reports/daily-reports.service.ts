import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import {
  DailyReportInput,
  DailyReportStatus,
  formatDailyReportNumber,
  formatInspectionReportNumber,
  formatPercent,
  formatProgressReportNumber,
  InspectionReportCreate,
  PaginationQuery,
  ProgressReportCreate,
  Role,
} from '@construction/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { AuthUser } from '../common/decorators';
import { AppException } from '../common/errors';
import { ProjectAccessService } from '../common/project-access.service';
import { CompanyService } from '../company/company.service';
import { FilesService } from '../files/files.service';
import { PdfService } from '../pdf/pdf.service';

function formatDateOnly(val: Date | string | null | undefined): string {
  if (!val) return '';
  if (typeof val === 'string') return val.slice(0, 10);
  return val.toISOString().slice(0, 10);
}

function getKlTodayDateStr(): string {
  const now = new Date();
  const klMs = now.getTime() + 8 * 60 * 60 * 1000;
  return new Date(klMs).toISOString().slice(0, 10);
}

function diffDaysBetweenDates(laterYmd: string, earlierYmd: string): number {
  const d1 = new Date(`${laterYmd}T00:00:00.000Z`).getTime();
  const d2 = new Date(`${earlierYmd}T00:00:00.000Z`).getTime();
  return Math.round((d1 - d2) / (24 * 60 * 60 * 1000));
}

@Injectable()
export class DailyReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccessService: ProjectAccessService,
    private readonly filesService: FilesService,
    private readonly companyService: CompanyService,
    private readonly pdfService: PdfService,
    private readonly auditService: AuditService,
  ) {}

  isWithinEditWindow(reportDateVal: Date | string): boolean {
    const reportYmd = formatDateOnly(reportDateVal);
    const todayYmd = getKlTodayDateStr();
    const diffDays = diffDaysBetweenDates(todayYmd, reportYmd);
    return diffDays >= 0 && diffDays <= 2;
  }

  async serializeReport(report: any, viewer: AuthUser) {
    const photos = await Promise.all(
      (report.photos || []).map(async (p: any) => {
        let url = `http://localhost:3000/api/v1/files/${p.fileId}/content`;
        try {
          const dl = await this.filesService.getDownloadUrl(p.fileId);
          url = dl.url;
        } catch {
          // fallback URL if file pending
        }
        return {
          id: p.id,
          fileId: p.fileId,
          caption: p.caption ?? null,
          takenAt: p.takenAt instanceof Date ? p.takenAt.toISOString() : p.takenAt ?? null,
          sortOrder: p.sortOrder,
          url,
        };
      }),
    );

    const isEditable =
      report.submittedById === viewer.id &&
      report.status !== DailyReportStatus.REVIEWED &&
      this.isWithinEditWindow(report.reportDate);

    const reportDateStr = formatDateOnly(report.reportDate);
    const docNumber =
      report.number ||
      (report.project?.code
        ? formatDailyReportNumber(report.project.code, reportDateStr)
        : `DR-${reportDateStr.replace(/-/g, '')}`);

    return {
      id: report.id,
      number: docNumber,
      projectId: report.projectId,
      ...(report.project
        ? {
            project: {
              id: report.project.id,
              code: report.project.code,
              name: report.project.name,
            },
          }
        : {}),
      reportDate: reportDateStr,
      submittedById: report.submittedById,
      ...(report.submittedBy
        ? {
            submittedBy: {
              id: report.submittedBy.id,
              name: report.submittedBy.name,
              role: report.submittedBy.role,
            },
          }
        : {}),
      weather: report.weather ?? null,
      workDone: report.workDone,
      issues: report.issues ?? null,
      nextDayPlan: report.nextDayPlan ?? null,
      status: report.status,
      reviewedById: report.reviewedById ?? null,
      reviewedAt:
        report.reviewedAt instanceof Date
          ? report.reviewedAt.toISOString()
          : report.reviewedAt ?? null,
      latitude:
        report.latitude !== null && report.latitude !== undefined
          ? Number(report.latitude.toString())
          : null,
      longitude:
        report.longitude !== null && report.longitude !== undefined
          ? Number(report.longitude.toString())
          : null,
      deviceCreatedAt:
        report.deviceCreatedAt instanceof Date
          ? report.deviceCreatedAt.toISOString()
          : report.deviceCreatedAt ?? null,
      isEditable,
      manpower: (report.manpower || []).map((m: any) => ({
        id: m.id,
        trade: m.trade,
        headcount: Number(m.headcount),
      })),
      photos,
      progress: (report.progress || []).map((pr: any) => ({
        id: pr.id,
        contractItemId: pr.contractItemId,
        percentComplete: formatPercent(pr.percentComplete),
      })),
      createdAt:
        report.createdAt instanceof Date ? report.createdAt.toISOString() : report.createdAt,
      updatedAt:
        report.updatedAt instanceof Date ? report.updatedAt.toISOString() : report.updatedAt,
    };
  }

  async list(
    user: AuthUser,
    query: PaginationQuery & {
      projectId?: string;
      from?: string;
      to?: string;
      submittedById?: string;
      status?: DailyReportStatus;
    },
  ) {
    if (query.projectId) {
      await this.projectAccessService.assertMember(user, query.projectId);
    }

    let allowedProjectIds: Set<string> | null = null;
    if (user.role === Role.SITE_STAFF || user.role === Role.PROJECT_MANAGER) {
      const mems = await this.prisma.projectMember.findMany({
        where: { userId: user.id },
      });
      allowedProjectIds = new Set(mems.map((m: any) => m.projectId));
    }

    const all = await this.prisma.dailyReport.findMany({
      include: {
        project: true,
        submittedBy: true,
        manpower: true,
        photos: true,
        progress: true,
      },
      orderBy: { reportDate: 'desc' },
    });

    const filtered = all.filter((r: any) => {
      if (allowedProjectIds && !allowedProjectIds.has(r.projectId)) return false;
      if (query.projectId && r.projectId !== query.projectId) return false;
      if (query.submittedById && r.submittedById !== query.submittedById) return false;
      if (query.status && r.status !== query.status) return false;
      const rDate = formatDateOnly(r.reportDate);
      if (query.from && rDate < query.from) return false;
      if (query.to && rDate > query.to) return false;
      if (query.q) {
        const needle = query.q.toLowerCase();
        if (!String(r.workDone || '').toLowerCase().includes(needle)) return false;
      }
      return true;
    });

    const total = filtered.length;
    const skip = (query.page - 1) * query.pageSize;
    const paged = filtered.slice(skip, skip + query.pageSize);
    const serialized = await Promise.all(paged.map((r: any) => this.serializeReport(r, user)));

    return {
      items: serialized,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getById(user: AuthUser, id: string, tx?: any) {
    const db = tx || this.prisma;
    const report = await db.dailyReport.findUnique({
      where: { id },
      include: {
        project: true,
        submittedBy: true,
        manpower: true,
        photos: true,
        progress: true,
      },
    });
    if (!report) {
      throw AppException.notFound('NOT_FOUND', 'Daily report not found');
    }
    await this.projectAccessService.assertMember(user, report.projectId);
    return this.serializeReport(report, user);
  }

  async upsert(
    user: AuthUser,
    id: string,
    dto: DailyReportInput,
  ): Promise<{ created: boolean; report: any }> {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) {
      throw AppException.notFound('NOT_FOUND', 'Project not found');
    }

    await this.projectAccessService.assertMember(user, dto.projectId);

    const existingById = await this.prisma.dailyReport.findUnique({
      where: { id },
    });

    if (existingById) {
      if (existingById.submittedById !== user.id) {
        throw AppException.forbidden(
          'DAILY_REPORT_NOT_AUTHOR',
          'The report exists and was submitted by another user',
        );
      }
      if (
        existingById.status === DailyReportStatus.REVIEWED ||
        !this.isWithinEditWindow(existingById.reportDate)
      ) {
        throw AppException.conflict(
          'DAILY_REPORT_LOCKED',
          'The report is REVIEWED or the 48 hour edit window has passed',
        );
      }
    }

    const todayYmd = getKlTodayDateStr();
    const diffDays = diffDaysBetweenDates(todayYmd, dto.reportDate);
    if (diffDays < 0 || diffDays > 2) {
      throw AppException.unprocessable(
        'REPORT_DATE_OUT_OF_RANGE',
        'reportDate must be today or up to 2 days back, never in the future',
      );
    }

    const reportDateObj = new Date(`${dto.reportDate}T00:00:00.000Z`);

    const existingForSlot = await this.prisma.dailyReport.findFirst({
      where: {
        projectId: dto.projectId,
        reportDate: reportDateObj,
        submittedById: user.id,
      },
    });
    if (existingForSlot && existingForSlot.id !== id) {
      throw AppException.conflict(
        'DAILY_REPORT_ALREADY_EXISTS',
        'You already have a report for this project and date',
        { existingId: existingForSlot.id },
      );
    }

    for (const p of dto.photos) {
      await this.filesService.verifyAndMarkReady(p.fileId);
    }

    const docNumber = formatDailyReportNumber(project.code, dto.reportDate);

    return this.prisma.$transaction(async (tx: any) => {
      const created = !existingById;
      if (created) {
        await tx.dailyReport.create({
          data: {
            id,
            number: docNumber,
            projectId: dto.projectId,
            reportDate: reportDateObj,
            submittedById: user.id,
            weather: dto.weather ?? 'SUNNY',
            workDone: dto.workDone.trim(),
            issues: dto.issues ?? null,
            nextDayPlan: dto.nextDayPlan ?? null,
            status: DailyReportStatus.SUBMITTED,
            latitude: dto.latitude ?? null,
            longitude: dto.longitude ?? null,
            deviceCreatedAt: dto.deviceCreatedAt ? new Date(dto.deviceCreatedAt) : new Date(),
          },
        });
      } else {
        await tx.dailyReportManpower.deleteMany({ where: { dailyReportId: id } });
        await tx.dailyReportPhoto.deleteMany({ where: { dailyReportId: id } });
        await tx.dailyReportProgress.deleteMany({ where: { dailyReportId: id } });

        await tx.dailyReport.update({
          where: { id },
          data: {
            number: docNumber,
            reportDate: reportDateObj,
            weather: dto.weather ?? 'SUNNY',
            workDone: dto.workDone.trim(),
            issues: dto.issues ?? null,
            nextDayPlan: dto.nextDayPlan ?? null,
            latitude: dto.latitude ?? null,
            longitude: dto.longitude ?? null,
            deviceCreatedAt: dto.deviceCreatedAt
              ? new Date(dto.deviceCreatedAt)
              : existingById.deviceCreatedAt,
          },
        });
      }

      for (const m of dto.manpower) {
        await tx.dailyReportManpower.create({
          data: {
            id: uuidv7(),
            dailyReportId: id,
            trade: m.trade.trim(),
            headcount: m.headcount,
          },
        });
      }

      for (let i = 0; i < dto.photos.length; i++) {
        const p = dto.photos[i];
        await tx.dailyReportPhoto.create({
          data: {
            id: uuidv7(),
            dailyReportId: id,
            fileId: p.fileId,
            caption: p.caption ?? null,
            takenAt: p.takenAt ? new Date(p.takenAt) : null,
            sortOrder: i,
          },
        });
      }

      for (const pr of dto.progress || []) {
        await tx.dailyReportProgress.create({
          data: {
            id: uuidv7(),
            dailyReportId: id,
            contractItemId: pr.contractItemId,
            percentComplete: pr.percentComplete,
          },
        });
      }

      const full = await this.getById(user, id, tx);
      return { created, report: full };
    });
  }

  async review(user: AuthUser, id: string) {
    const existing = await this.prisma.dailyReport.findUnique({ where: { id } });
    if (!existing) {
      throw AppException.notFound('NOT_FOUND', 'Daily report not found');
    }
    await this.projectAccessService.assertMember(user, existing.projectId);

    if (existing.status === DailyReportStatus.REVIEWED) {
      throw AppException.conflict(
        'DAILY_REPORT_ALREADY_REVIEWED',
        'The report is already REVIEWED',
      );
    }

    return this.prisma.$transaction(async (tx: any) => {
      await tx.dailyReport.update({
        where: { id },
        data: {
          status: DailyReportStatus.REVIEWED,
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
      });
      const updated = await this.getById(user, id, tx);
      await this.auditService.log(
        {
          userId: user.id,
          entity: 'DailyReport',
          entityId: id,
          action: 'REVIEW',
          after: { id, reviewedById: user.id },
        },
        tx,
      );
      return updated;
    });
  }

  async generateSiteReportPdf(user: AuthUser, projectId: string, from: string, to: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw AppException.notFound('NOT_FOUND', 'Project not found');
    }
    await this.projectAccessService.assertMember(user, projectId);

    const diff = diffDaysBetweenDates(to, from);
    if (diff < 0 || diff > 31) {
      throw AppException.unprocessable(
        'DATE_RANGE_TOO_LARGE',
        'The range between from and to must be between 0 and 31 days',
      );
    }

    const listRes = await this.list(user, {
      projectId,
      from,
      to,
      page: 1,
      pageSize: 100,
      sort: 'reportDate',
    });

    const company = await this.companyService.getCompany();
    const safeProject = {
      id: project.id,
      code: project.code,
      name: project.name,
      siteAddress: project.siteAddress,
    };

    const html = this.pdfService.renderSiteReportHtml({
      company,
      project: safeProject,
      reports: listRes.items,
      from,
      to,
    });

    return this.pdfService.renderHtmlToPdf(
      `Site Report ${project.code} (${from} to ${to})`,
      html,
    );
  }

  // ---------------------------------------------------------------------------
  // Progress Reports (PR-P26014-001) — backs Progress Claim billing
  // ---------------------------------------------------------------------------

  serializeProgressReport(pr: any) {
    return {
      id: pr.id,
      number: pr.number,
      projectId: pr.projectId,
      reportDate: formatDateOnly(pr.reportDate),
      periodFrom: formatDateOnly(pr.periodFrom) || null,
      periodTo: formatDateOnly(pr.periodTo) || null,
      summary: pr.summary ?? null,
      overallPercent: formatPercent(pr.overallPercent ?? 0),
      createdById: pr.createdById,
      lines: (pr.lines || []).map((l: any) => ({
        id: l.id,
        contractItemId: l.contractItemId,
        cumulativePercent: formatPercent(l.cumulativePercent),
        notes: l.notes ?? null,
      })),
      createdAt: pr.createdAt instanceof Date ? pr.createdAt.toISOString() : pr.createdAt,
      updatedAt: pr.updatedAt instanceof Date ? pr.updatedAt.toISOString() : pr.updatedAt,
    };
  }

  async listProgressReports(user: AuthUser, projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw AppException.notFound('NOT_FOUND', 'Project not found');
    }
    await this.projectAccessService.assertMember(user, projectId);

    const items = await this.prisma.progressReport.findMany({
      where: { projectId },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: items.map((pr: any) => this.serializeProgressReport(pr)),
      total: items.length,
      page: 1,
      pageSize: Math.max(1, items.length),
    };
  }

  async createProgressReport(user: AuthUser, projectId: string, dto: ProgressReportCreate) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw AppException.notFound('NOT_FOUND', 'Project not found');
    }
    await this.projectAccessService.assertMember(user, projectId);

    const existingCount = await this.prisma.progressReport.count({ where: { projectId } });
    const number = formatProgressReportNumber(project.code, existingCount + 1);
    const reportDate = dto.reportDate ? new Date(dto.reportDate) : new Date(getKlTodayDateStr());

    let overallPercent = dto.overallPercent || '0.00';
    if (!dto.overallPercent && dto.lines && dto.lines.length > 0) {
      const avg =
        dto.lines.reduce((acc, l) => acc + Number(l.cumulativePercent), 0) / dto.lines.length;
      overallPercent = formatPercent(avg);
    }

    return this.prisma.$transaction(async (tx: any) => {
      const pr = await tx.progressReport.create({
        data: {
          id: uuidv7(),
          number,
          projectId,
          reportDate,
          periodFrom: dto.periodFrom ? new Date(dto.periodFrom) : null,
          periodTo: dto.periodTo ? new Date(dto.periodTo) : null,
          summary: dto.summary ?? null,
          overallPercent,
          createdById: user.id,
        },
      });

      for (const line of dto.lines || []) {
        await tx.progressReportLine.create({
          data: {
            id: uuidv7(),
            progressReportId: pr.id,
            contractItemId: line.contractItemId,
            cumulativePercent: line.cumulativePercent,
            notes: line.notes ?? null,
          },
        });
      }

      const full = await tx.progressReport.findUnique({
        where: { id: pr.id },
        include: { lines: true },
      });
      return this.serializeProgressReport(full);
    });
  }

  // ---------------------------------------------------------------------------
  // Inspection Reports (IR-P26014-005)
  // ---------------------------------------------------------------------------

  serializeInspectionReport(ir: any) {
    return {
      id: ir.id,
      number: ir.number,
      projectId: ir.projectId,
      inspectionDate: formatDateOnly(ir.inspectionDate),
      title: ir.title,
      findings: ir.findings ?? null,
      status: ir.status,
      inspectorId: ir.inspectorId,
      createdAt: ir.createdAt instanceof Date ? ir.createdAt.toISOString() : ir.createdAt,
      updatedAt: ir.updatedAt instanceof Date ? ir.updatedAt.toISOString() : ir.updatedAt,
    };
  }

  async listInspectionReports(user: AuthUser, projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw AppException.notFound('NOT_FOUND', 'Project not found');
    }
    await this.projectAccessService.assertMember(user, projectId);

    const items = await this.prisma.inspectionReport.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: items.map((ir: any) => this.serializeInspectionReport(ir)),
      total: items.length,
      page: 1,
      pageSize: Math.max(1, items.length),
    };
  }

  async createInspectionReport(user: AuthUser, projectId: string, dto: InspectionReportCreate) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw AppException.notFound('NOT_FOUND', 'Project not found');
    }
    await this.projectAccessService.assertMember(user, projectId);

    const existingCount = await this.prisma.inspectionReport.count({ where: { projectId } });
    const number = formatInspectionReportNumber(project.code, existingCount + 1);
    const inspectionDate = dto.inspectionDate
      ? new Date(dto.inspectionDate)
      : new Date(getKlTodayDateStr());

    const created = await this.prisma.inspectionReport.create({
      data: {
        id: uuidv7(),
        number,
        projectId,
        inspectionDate,
        title: dto.title.trim(),
        findings: dto.findings ?? null,
        status: dto.status ?? 'PASSED',
        inspectorId: user.id,
      },
    });
    return this.serializeInspectionReport(created);
  }
}
