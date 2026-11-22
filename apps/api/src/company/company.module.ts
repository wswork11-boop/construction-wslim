import { Global, Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { SequenceService } from './sequence.service';

@Global()
@Module({
  controllers: [CompanyController],
  providers: [CompanyService, SequenceService],
  exports: [CompanyService, SequenceService],
})
export class CompanyModule {}
