import { Module, forwardRef } from '@nestjs/common';
import { PaymentsService } from '@app/finance/payments/payments.service';
import { PaymentsController } from '@app/finance/payments/payments.controller';
import { PAYMENT_GATEWAY } from '@app/finance/payments/gateway/gateway.interface';
import { MockGatewayService } from '@app/finance/payments/gateway/mock-gateway.service';
import { ZibalGatewayService } from '@app/finance/payments/gateway/zibal.gateway';
import { WalletModule } from '@app/finance/wallet/wallet.module';
import { EntitlementsModule } from '@app/finance/entitlements/entitlements.module';
import { RevenueModule } from '@app/finance/revenue/revenue.module';
import { SubscriptionsModule } from '@app/finance/subscriptions/subscriptions.module';
import { CartModule } from '@app/finance/cart/cart.module';
import { DonationsModule } from '@app/finance/donations/donations.module';
import { OrderRequestsModule } from '@app/order-requests/order-requests.module';

@Module({
  imports: [
    forwardRef(() => WalletModule),
    EntitlementsModule,
    RevenueModule,
    SubscriptionsModule,
    CartModule,
    DonationsModule,
    OrderRequestsModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    MockGatewayService,
    {
      provide: PAYMENT_GATEWAY,
      useClass: ZibalGatewayService,
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
