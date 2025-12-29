import { Module } from '@nestjs/common';
import { CartController } from '@app/finance/cart/cart.controller';
import { CartService } from '@app/finance/cart/cart.service';
import { DiscountsModule } from '@app/finance/discounts/discounts.module';

@Module({
  imports: [DiscountsModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
