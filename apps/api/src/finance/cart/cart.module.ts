import { Module } from '@nestjs/common';
import { CartController } from '@app/finance/cart/cart.controller';
import { CartService } from '@app/finance/cart/cart.service';
import { DiscountsModule } from '@app/finance/discounts/discounts.module';
import { SubscriptionsModule } from '@app/finance/subscriptions/subscriptions.module';

@Module({
  imports: [DiscountsModule, SubscriptionsModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
