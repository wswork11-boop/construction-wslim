import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ClientCreateSchema,
  ClientListQuerySchema,
  ClientUpdateSchema,
  Role,
} from '@construction/shared';
import { ClientsService } from './clients.service';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { parseWithZod } from '../common/zod';

@ApiTags('Clients')
@ApiBearerAuth()
@Controller('clients')
@Roles(Role.OWNER, Role.OFFICE)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  async list(@Query() query: unknown) {
    const parsed = parseWithZod(ClientListQuerySchema, query);
    return this.clientsService.list(parsed);
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = parseWithZod(ClientCreateSchema, body);
    return this.clientsService.create(user, dto);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.clientsService.getById(id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = parseWithZod(ClientUpdateSchema, body);
    return this.clientsService.update(user, id, dto);
  }
}
