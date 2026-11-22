import { Controller, Get, HttpStatus, Param, Query, Res } from '@nestjs/common';
import { Role } from '@construction/shared';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { ReportsService } from './reports.service';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  private sendJsonOrXlsx(
    res: any,
    format: string | undefined,
    data: unknown,
    fileName: string,
    buildXlsx: () => Buffer,
  ) {
    if (format === 'xlsx') {
      const buf = buildXlsx();
      res.setHeader('Content-Type', XLSX_MIME);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.status(HttpStatus.OK).send(buf);
      return;
    }
    res.status(HttpStatus.OK).json(data);
  }

  @Get('dashboard')
  @Roles(Role.OWNER, Role.OFFICE)
  async getDashboard(
    @Query('format') format: string | undefined,
    @Query('asOf') asOf: string | undefined,
    @Res() res: any,
  ) {
    const data = await this.reportsService.getDashboard(asOf);
    this.sendJsonOrXlsx(res, format, data, 'dashboard-report.xlsx', () =>
      this.reportsService.buildDashboardXlsx(data),
    );
  }

  @Get('projects/:id/summary')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async getProjectSummary(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: any,
  ) {
    const data = await this.reportsService.getProjectSummary(user, id, { from, to });
    this.sendJsonOrXlsx(
      res,
      format,
      data,
      `project-${data.project.code}-summary.xlsx`,
      () => this.reportsService.buildProjectSummaryXlsx(data),
    );
  }

  @Get('receivables-ageing')
  @Roles(Role.OWNER, Role.OFFICE)
  async getReceivablesAgeing(
    @Query('asOf') asOf: string | undefined,
    @Query('clientId') clientId: string | undefined,
    @Query('projectId') projectId: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: any,
  ) {
    const data = await this.reportsService.getReceivablesAgeing({ asOf, clientId, projectId });
    this.sendJsonOrXlsx(
      res,
      format,
      data,
      `receivables-ageing-${data.asOf}.xlsx`,
      () => this.reportsService.buildReceivablesAgeingXlsx(data),
    );
  }

  @Get('quotation-pipeline')
  @Roles(Role.OWNER, Role.OFFICE)
  async getQuotationPipeline(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('clientId') clientId: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: any,
  ) {
    const data = await this.reportsService.getQuotationPipeline({ from, to, clientId });
    this.sendJsonOrXlsx(res, format, data, 'quotation-pipeline.xlsx', () =>
      this.reportsService.buildQuotationPipelineXlsx(data),
    );
  }

  @Get('billing-collections')
  @Roles(Role.OWNER, Role.OFFICE)
  async getBillingCollections(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('clientId') clientId: string | undefined,
    @Query('projectId') projectId: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: any,
  ) {
    const data = await this.reportsService.getBillingCollections({
      from,
      to,
      clientId,
      projectId,
    });
    this.sendJsonOrXlsx(res, format, data, 'billing-collections.xlsx', () =>
      this.reportsService.buildBillingCollectionsXlsx(data),
    );
  }

  @Get('retention')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async getRetentionRegister(
    @CurrentUser() user: AuthUser,
    @Query('clientId') clientId: string | undefined,
    @Query('projectId') projectId: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: any,
  ) {
    const data = await this.reportsService.getRetentionRegister(user, { clientId, projectId });
    this.sendJsonOrXlsx(res, format, data, 'retention-register.xlsx', () =>
      this.reportsService.buildRetentionRegisterXlsx(data),
    );
  }

  @Get('daily-report-compliance')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async getDailyReportCompliance(
    @CurrentUser() user: AuthUser,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('projectId') projectId: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: any,
  ) {
    const data = await this.reportsService.getDailyReportCompliance(user, {
      from,
      to,
      projectId,
    });
    this.sendJsonOrXlsx(
      res,
      format,
      data,
      `daily-report-compliance-${data.from}-${data.to}.xlsx`,
      () => this.reportsService.buildDailyReportComplianceXlsx(data),
    );
  }

  @Get('expenses')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async getExpensesReport(
    @CurrentUser() user: AuthUser,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('projectId') projectId: string | undefined,
    @Query('category') category: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: any,
  ) {
    const data = await this.reportsService.getExpensesReport(user, {
      from,
      to,
      projectId,
      category,
    });
    this.sendJsonOrXlsx(res, format, data, 'expenses-report.xlsx', () =>
      this.reportsService.buildExpensesReportXlsx(data),
    );
  }
}
