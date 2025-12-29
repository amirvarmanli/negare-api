import { Module } from '@nestjs/common';
import { DiscountsService } from '@app/finance/discounts/discounts.service';
import { DiscountsAdminService } from '@app/finance/discounts/discounts-admin.service';
import { DiscountsController } from '@app/finance/discounts/discounts.controller';

@Module({
  controllers: [DiscountsController],
  providers: [DiscountsService, DiscountsAdminService],
  exports: [DiscountsService],
})
export class DiscountsModule {}
