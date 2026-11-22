import {
  Body,
  Controller,
  Delete,
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
  CreditNoteCreateSchema,
  CsvExportQuerySchema,
  InvoiceListQuerySchema,
  InvoiceVoidRequestSchema,
  PaymentCreateSchema,
  PaymentListQuerySchema,
  ProgressClaimCreateSchema,
  ProgressClaimUpdateSchema,
  RetentionReleaseCreateSchema,
  RetentionReleaseUpdateSchema,
  Role,
  SimpleInvoiceCreateSchema,
  SimpleInvoiceUpdateSchema,
} from '@construction/shared';
import { InvoicesService } from './invoices.service';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { parseWithZod } from '../common/zod';

@ApiTags('Invoices', 'Payments')
@ApiBearerAuth()
@Controller()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('invoices')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async listInvoices(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    const parsed = parseWithZod(InvoiceListQuerySchema, query);
    return this.invoicesService.list(user, parsed);
  }

  @Post('invoices')
  @Roles(Role.OWNER, Role.OFFICE)
  async createSimpleInvoice(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = parseWithZod(SimpleInvoiceCreateSchema, body);
    return this.invoicesService.createSimpleInvoice(user, dto);
  }

  @Get('invoices/:id')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async getInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invoicesService.getById(user, id);
  }

  @Put('invoices/:id')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async replaceInvoice(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    if (body && Array.isArray(body.lines)) {
      const dto = parseWithZod(SimpleInvoiceUpdateSchema, body);
      return this.invoicesService.replace(user, id, dto);
    }
    if (body && Array.isArray(body.claimLines)) {
      const dto = parseWithZod(ProgressClaimUpdateSchema, body);
      return this.invoicesService.replace(user, id, dto);
    }
    if (body && typeof body.amount === 'string') {
      const dto = parseWithZod(RetentionReleaseUpdateSchema, body);
      return this.invoicesService.replace(user, id, dto);
    }
    return this.invoicesService.replace(user, id, body);
  }

  @Delete('invoices/:id')
  @Roles(Role.OWNER, Role.OFFICE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.invoicesService.delete(user, id);
  }

  @Post('projects/:id/progress-claims')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async createProgressClaim(
    @CurrentUser() user: AuthUser,
    @Param('id') projectId: string,
    @Body() body?: unknown,
  ) {
    const dto =
      body && typeof body === 'object' && Object.keys(body).length > 0
        ? parseWithZod(ProgressClaimCreateSchema, body)
        : {};
    return this.invoicesService.createProgressClaim(user, projectId, dto);
  }

  @Post('projects/:id/retention-releases')
  @Roles(Role.OWNER, Role.OFFICE)
  async createRetentionRelease(
    @CurrentUser() user: AuthUser,
    @Param('id') projectId: string,
    @Body() body: unknown,
  ) {
    const dto = parseWithZod(RetentionReleaseCreateSchema, body);
    return this.invoicesService.createRetentionRelease(user, projectId, dto);
  }

  @Post('invoices/:id/issue')
  @Roles(Role.OWNER, Role.OFFICE)
  @HttpCode(HttpStatus.OK)
  async issueInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invoicesService.issue(user, id);
  }

  @Post('invoices/:id/void')
  @Roles(Role.OWNER, Role.OFFICE)
  @HttpCode(HttpStatus.OK)
  async voidInvoice(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = parseWithZod(InvoiceVoidRequestSchema, body);
    return this.invoicesService.voidInvoice(user, id, dto);
  }

  @Get('invoices/:id/pdf')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async getInvoicePdf(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invoicesService.getPdfUrl(user, id);
  }

  @Post('invoices/:id/credit-notes')
  @Roles(Role.OWNER, Role.OFFICE)
  async createCreditNote(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = parseWithZod(CreditNoteCreateSchema, body);
    return this.invoicesService.createCreditNote(user, id, dto);
  }

  @Get('payments')
  @Roles(Role.OWNER, Role.OFFICE)
  async listPayments(@Query() query: unknown) {
    const parsed = parseWithZod(PaymentListQuerySchema, query);
    return this.invoicesService.listPayments(parsed);
  }

  @Post('payments')
  @Roles(Role.OWNER, Role.OFFICE)
  async createPayment(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = parseWithZod(PaymentCreateSchema, body);
    return this.invoicesService.createPayment(user, dto);
  }

  @Delete('payments/:id')
  @Roles(Role.OWNER, Role.OFFICE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePayment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.invoicesService.deletePayment(user, id);
  }

  @Get('exports/invoices.csv')
  @Roles(Role.OWNER, Role.OFFICE)
  async exportInvoicesCsv(@Query() query: unknown, @Res() res: any) {
    const parsed = parseWithZod(CsvExportQuerySchema, query);
    const csv = await this.invoicesService.exportInvoicesCsv(parsed.from, parsed.to);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="invoices-${parsed.from}-${parsed.to}.csv"`);
    res.status(HttpStatus.OK).send(csv);
  }

  @Get('exports/payments.csv')
  @Roles(Role.OWNER, Role.OFFICE)
  async exportPaymentsCsv(@Query() query: unknown, @Res() res: any) {
    const parsed = parseWithZod(CsvExportQuerySchema, query);
    const csv = await this.invoicesService.exportPaymentsCsv(parsed.from, parsed.to);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payments-${parsed.from}-${parsed.to}.csv"`);
    res.status(HttpStatus.OK).send(csv);
  }
}
