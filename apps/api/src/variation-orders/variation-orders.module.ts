import { Module } from '@nestjs/common';
import { VariationOrdersController } from './variation-orders.controller';
import { VariationOrdersService } from './variation-orders.service';

@Module({
  controllers: [VariationOrdersController],
  providers: [VariationOrdersService],
  exports: [VariationOrdersService],
})
export class VariationOrdersModule {}
