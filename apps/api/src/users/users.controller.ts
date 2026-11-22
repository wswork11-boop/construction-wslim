import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Role,
  UserCreateSchema,
  UserListQuerySchema,
  UserUpdateSchema,
} from '@construction/shared';
import { UsersService } from './users.service';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { parseWithZod } from '../common/zod';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@Roles(Role.OWNER)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(@Query() query: unknown) {
    const parsed = parseWithZod(UserListQuerySchema, query);
    return this.usersService.list(parsed);
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = parseWithZod(UserCreateSchema, body);
    return this.usersService.create(user, dto);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.usersService.getById(id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = parseWithZod(UserUpdateSchema, body);
    return this.usersService.update(user, id, dto);
  }
}
