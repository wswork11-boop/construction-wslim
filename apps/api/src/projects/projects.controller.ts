import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  ProjectCreateSchema,
  ProjectListQuerySchema,
  ProjectMembersInputSchema,
  ProjectUpdateSchema,
  Role,
} from '@construction/shared';
import { ProjectsService } from './projects.service';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { parseWithZod } from '../common/zod';

const ContractFromQuotationSchema = z.object({
  quotationId: z.string().uuid(),
});

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    const parsed = parseWithZod(ProjectListQuerySchema, query);
    return this.projectsService.list(user, parsed);
  }

  @Post()
  @Roles(Role.OWNER, Role.OFFICE)
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = parseWithZod(ProjectCreateSchema, body);
    return this.projectsService.create(user, dto);
  }

  @Get(':id')
  async getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projectsService.getById(user, id);
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.OFFICE)
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = parseWithZod(ProjectUpdateSchema, body);
    return this.projectsService.update(user, id, dto);
  }

  @Put(':id/members')
  @Roles(Role.OWNER, Role.OFFICE)
  async replaceMembers(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = parseWithZod(ProjectMembersInputSchema, body);
    return this.projectsService.replaceMembers(user, id, dto);
  }

  @Post(':id/contract/from-quotation')
  @Roles(Role.OWNER, Role.OFFICE)
  async createContractFromQuotation(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = parseWithZod(ContractFromQuotationSchema, body);
    return this.projectsService.createContractFromQuotation(user, id, dto.quotationId);
  }

  @Get(':id/contract')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async getContract(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projectsService.getContract(user, id);
  }
}
