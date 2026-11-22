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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  PaginationQuerySchema,
  QuotationAcceptRequestSchema,
  QuotationInputSchema,
  QuotationListQuerySchema,
  QuotationRejectRequestSchema,
  Role,
} from '@construction/shared';
import { QuotationsService } from './quotations.service';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { parseWithZod } from '../common/zod';

@ApiTags('Quotations')
@ApiBearerAuth()
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Get()
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async list(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    const parsed = parseWithZod(QuotationListQuerySchema, query);
    return this.quotationsService.list(user, parsed);
  }

  @Post()
  @Roles(Role.OWNER, Role.OFFICE)
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = parseWithZod(QuotationInputSchema, body);
    return this.quotationsService.create(user, dto);
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quotationsService.getById(user, id);
  }

  @Put(':id')
  @Roles(Role.OWNER, Role.OFFICE)
  async replace(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = parseWithZod(QuotationInputSchema, body);
    return this.quotationsService.replace(user, id, dto);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.OFFICE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.quotationsService.delete(user, id);
  }

  @Post(':id/send')
  @Roles(Role.OWNER, Role.OFFICE)
  @HttpCode(HttpStatus.OK)
  async send(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quotationsService.send(user, id);
  }

  @Post(':id/accept')
  @Roles(Role.OWNER, Role.OFFICE)
  @HttpCode(HttpStatus.OK)
  async accept(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body?: unknown,
  ) {
    const opts =
      body && typeof body === 'object' && Object.keys(body).length > 0
        ? parseWithZod(QuotationAcceptRequestSchema, body)
        : undefined;
    return this.quotationsService.accept(user, id, opts);
  }

  @Post(':id/reject')
  @Roles(Role.OWNER, Role.OFFICE)
  @HttpCode(HttpStatus.OK)
  async reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = parseWithZod(QuotationRejectRequestSchema, body);
    return this.quotationsService.reject(user, id, dto);
  }

  @Post(':id/revise')
  @Roles(Role.OWNER, Role.OFFICE)
  async revise(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quotationsService.revise(user, id);
  }

  @Post(':id/duplicate')
  @Roles(Role.OWNER, Role.OFFICE)
  async duplicate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quotationsService.duplicate(user, id);
  }

  @Get(':id/revisions')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async listRevisions(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: unknown,
  ) {
    const parsed = parseWithZod(PaginationQuerySchema, query);
    return this.quotationsService.listRevisions(user, id, parsed);
  }

  @Get(':id/pdf')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async getPdf(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quotationsService.getPdfUrl(user, id);
  }
}
