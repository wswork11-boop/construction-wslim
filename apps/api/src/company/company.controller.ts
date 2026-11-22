import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  CompanyUpdateSchema,
  PaginationQuerySchema,
  Role,
  TaxRateCreateSchema,
  TaxRateUpdateSchema,
} from '@construction/shared';
import { CompanyService } from './company.service';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { parseWithZod } from '../common/zod';

const TaxRateListQuerySchema = PaginationQuerySchema.extend({
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .or(z.boolean())
    .optional(),
});

@ApiTags('Company')
@ApiBearerAuth()
@Controller()
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get('company')
  async getCompany() {
    return this.companyService.getCompany();
  }

  @Patch('company')
  @Roles(Role.OWNER)
  async updateCompany(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = parseWithZod(CompanyUpdateSchema, body);
    return this.companyService.updateCompany(user, dto);
  }

  @Get('tax-rates')
  @Roles(Role.OWNER, Role.OFFICE)
  async listTaxRates(@Query() query: unknown) {
    const parsed = parseWithZod(TaxRateListQuerySchema, query);
    return this.companyService.listTaxRates(parsed);
  }

  @Post('tax-rates')
  @Roles(Role.OWNER)
  async createTaxRate(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = parseWithZod(TaxRateCreateSchema, body);
    return this.companyService.createTaxRate(user, dto);
  }

  @Patch('tax-rates/:id')
  @Roles(Role.OWNER)
  async updateTaxRate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = parseWithZod(TaxRateUpdateSchema, body);
    return this.companyService.updateTaxRate(user, id, dto);
  }
}
