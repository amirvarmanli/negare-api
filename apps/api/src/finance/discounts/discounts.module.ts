import { Module } from '@nestjs/common';
import { DiscountsService } from '@app/finance/discounts/discounts.service';
import { DiscountCouponsAdminService } from '@app/finance/discounts/discount-coupons-admin.service';
import { DiscountCouponsController } from '@app/finance/discounts/discount-coupons.controller';

@Module({
  controllers: [DiscountCouponsController],
  providers: [DiscountsService, DiscountCouponsAdminService],
  exports: [DiscountsService],
})
export class DiscountsModule {}
