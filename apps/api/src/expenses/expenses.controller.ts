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
  CsvExportQuerySchema,
  ExpenseCreateSchema,
  ExpenseListQuerySchema,
  ExpensePaySchema,
  ExpenseUpdateSchema,
  ExpenseVoidSchema,
  Role,
} from '@construction/shared';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { parseWithZod } from '../common/zod';
import { ExpensesService } from './expenses.service';

@ApiTags('Expenses')
@ApiBearerAuth()
@Controller()
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get('expenses')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async listExpenses(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    const parsed = parseWithZod(ExpenseListQuerySchema, query);
    return this.expensesService.list(user, parsed);
  }

  @Post('expenses')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async createExpense(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = parseWithZod(ExpenseCreateSchema, body);
    return this.expensesService.create(user, dto);
  }

  @Get('expenses/:id')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async getExpense(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.expensesService.getById(user, id);
  }

  @Put('expenses/:id')
  @Roles(Role.OWNER, Role.OFFICE, Role.PROJECT_MANAGER)
  async updateExpense(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = parseWithZod(ExpenseUpdateSchema, body);
    return this.expensesService.update(user, id, dto);
  }

  @Post('expenses/:id/pay')
  @Roles(Role.OWNER, Role.OFFICE)
  @HttpCode(HttpStatus.OK)
  async payExpense(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = parseWithZod(ExpensePaySchema, body);
    return this.expensesService.pay(user, id, dto);
  }

  @Post('expenses/:id/void')
  @Roles(Role.OWNER, Role.OFFICE)
  @HttpCode(HttpStatus.OK)
  async voidExpense(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = parseWithZod(ExpenseVoidSchema, body);
    return this.expensesService.void(user, id, dto);
  }

  @Get('exports/expenses.csv')
  @Roles(Role.OWNER, Role.OFFICE)
  async exportExpensesCsv(@Query() query: unknown, @Res() res: any) {
    const parsed = parseWithZod(CsvExportQuerySchema, query);
    const csv = await this.expensesService.exportExpensesCsv(parsed.from, parsed.to);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="expenses-${parsed.from}-${parsed.to}.csv"`,
    );
    res.status(HttpStatus.OK).send(csv);
  }
}
