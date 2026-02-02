import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { ProductsModule } from '@app/finance/products/products.module';
import { PaymentsModule } from '@app/finance/payments/payments.module';
import { DiscountsModule } from '@app/finance/discounts/discounts.module';

@Module({
  imports: [ProductsModule, PaymentsModule, DiscountsModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
