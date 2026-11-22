import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  DailyReportInputSchema,
  DailyReportListQuerySchema,
  InspectionReportCreateSchema,
  ProgressReportCreateSchema,
  Role,
  SiteReportPdfQuerySchema,
} from '@construction/shared';
import { DailyReportsService } from './daily-reports.service';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { parseWithZod } from '../common/zod';

@ApiTags('DailyReports')
@ApiBearerAuth()
@Controller()
export class DailyReportsController {
  constructor(private readonly dailyReportsService: DailyReportsService) {}

  @Get('daily-reports')
  async list(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    const parsed = parseWithZod(DailyReportListQuerySchema, query);
    return this.dailyReportsService.list(user, parsed);
  }

  @Get('daily-reports/:id')
  async getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.dailyReportsService.getById(user, id);
  }

  @Put('daily-reports/:id')
  async upsert(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: any,
  ) {
    const dto = parseWithZod(DailyReportInputSchema, body);
    const { created, report } = await this.dailyReportsService.upsert(user, id, dto);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return report;
  }

  @Post('daily-reports/:id/review')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  @HttpCode(HttpStatus.OK)
  async review(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.dailyReportsService.review(user, id);
  }

  @Get('projects/:id/site-report.pdf')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async getSiteReportPdf(
    @CurrentUser() user: AuthUser,
    @Param('id') projectId: string,
    @Query() query: unknown,
    @Res() res: any,
  ) {
    const parsed = parseWithZod(SiteReportPdfQuerySchema, query);
    const pdfBuffer = await this.dailyReportsService.generateSiteReportPdf(
      user,
      projectId,
      parsed.from,
      parsed.to,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="site-report-${projectId}-${parsed.from}.pdf"`,
    );
    res.status(HttpStatus.OK).send(pdfBuffer);
  }

  @Get('projects/:id/progress-reports')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async listProgressReports(@CurrentUser() user: AuthUser, @Param('id') projectId: string) {
    return this.dailyReportsService.listProgressReports(user, projectId);
  }

  @Post('projects/:id/progress-reports')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async createProgressReport(
    @CurrentUser() user: AuthUser,
    @Param('id') projectId: string,
    @Body() body: unknown,
  ) {
    const dto = parseWithZod(ProgressReportCreateSchema, body);
    return this.dailyReportsService.createProgressReport(user, projectId, dto);
  }

  @Get('projects/:id/inspection-reports')
  async listInspectionReports(@CurrentUser() user: AuthUser, @Param('id') projectId: string) {
    return this.dailyReportsService.listInspectionReports(user, projectId);
  }

  @Post('projects/:id/inspection-reports')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async createInspectionReport(
    @CurrentUser() user: AuthUser,
    @Param('id') projectId: string,
    @Body() body: unknown,
  ) {
    const dto = parseWithZod(InspectionReportCreateSchema, body);
    return this.dailyReportsService.createInspectionReport(user, projectId, dto);
  }
}
