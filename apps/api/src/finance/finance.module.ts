import { Module } from '@nestjs/common';
import { ProductsModule } from '@app/finance/products/products.module';
import { OrdersModule } from '@app/finance/orders/orders.module';
import { PaymentsModule } from '@app/finance/payments/payments.module';
import { WalletModule } from '@app/finance/wallet/wallet.module';
import { EntitlementsModule } from '@app/finance/entitlements/entitlements.module';
import { DownloadsModule } from '@app/finance/downloads/downloads.module';
import { SubscriptionsModule } from '@app/finance/subscriptions/subscriptions.module';
import { RevenueModule } from '@app/finance/revenue/revenue.module';
import { DiscountsModule } from '@app/finance/discounts/discounts.module';
import { PayoutsModule } from '@app/finance/payouts/payouts.module';
import { CartModule } from '@app/finance/cart/cart.module';
import { PurchasesModule } from '@app/finance/purchases/purchases.module';
import { DonationsModule } from '@app/finance/donations/donations.module';
import { SubscriptionSystemModule } from '@app/finance/subscription-system/subscription-system.module';
import { CheckoutModule } from '@app/finance/checkout/checkout.module';
import { CreditsModule } from '@app/finance/credits/credits.module';

@Module({
  imports: [
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    WalletModule,
    EntitlementsModule,
    DownloadsModule,
    SubscriptionsModule,
    RevenueModule,
    DiscountsModule,
    CheckoutModule,
    PayoutsModule,
    CartModule,
    PurchasesModule,
    DonationsModule,
    SubscriptionSystemModule,
    CreditsModule,
  ],
})
export class FinanceModule {}
