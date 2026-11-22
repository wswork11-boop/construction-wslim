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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Role,
  VariationOrderInputSchema,
  VariationOrderListQuerySchema,
} from '@construction/shared';
import { VariationOrdersService } from './variation-orders.service';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { parseWithZod } from '../common/zod';

@ApiTags('VariationOrders')
@ApiBearerAuth()
@Controller()
export class VariationOrdersController {
  constructor(private readonly variationOrdersService: VariationOrdersService) {}

  @Get('projects/:id/variation-orders')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async listByProject(
    @CurrentUser() user: AuthUser,
    @Param('id') projectId: string,
    @Query() query: unknown,
  ) {
    const parsed = parseWithZod(VariationOrderListQuerySchema, query);
    return this.variationOrdersService.listByProject(user, projectId, parsed);
  }

  @Post('projects/:id/variation-orders')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async create(
    @CurrentUser() user: AuthUser,
    @Param('id') projectId: string,
    @Body() body: unknown,
  ) {
    const dto = parseWithZod(VariationOrderInputSchema, body);
    return this.variationOrdersService.create(user, projectId, dto);
  }

  @Get('variation-orders/:id')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.variationOrdersService.getById(user, id);
  }

  @Put('variation-orders/:id')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async replace(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = parseWithZod(VariationOrderInputSchema, body);
    return this.variationOrdersService.replace(user, id, dto);
  }

  @Post('variation-orders/:id/submit')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  @HttpCode(HttpStatus.OK)
  async submit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.variationOrdersService.submit(user, id);
  }

  @Post('variation-orders/:id/approve')
  @Roles(Role.OWNER, Role.OFFICE)
  @HttpCode(HttpStatus.OK)
  async approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.variationOrdersService.approve(user, id);
  }

  @Post('variation-orders/:id/reject')
  @Roles(Role.OWNER, Role.OFFICE)
  @HttpCode(HttpStatus.OK)
  async reject(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.variationOrdersService.reject(user, id);
  }
}
