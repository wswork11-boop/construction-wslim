import { Module } from '@nestjs/common';
import { CompanyModule } from '../company/company.module';
import { FilesModule } from '../files/files.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [CompanyModule, FilesModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
