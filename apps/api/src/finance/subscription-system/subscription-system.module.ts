import { Module } from '@nestjs/common';
import { CatalogModule } from '@app/catalog/catalog.module';
import { ProductsModule } from '@app/finance/products/products.module';
import { SubscriptionPlansService } from '@app/finance/subscription-system/subscription-plans.service';
import { UserSubscriptionsService } from '@app/finance/subscription-system/user-subscriptions.service';
import { SubscriptionDownloadsService } from '@app/finance/subscription-system/subscription-downloads.service';
import { SubscriptionSettlementsService } from '@app/finance/subscription-system/subscription-settlements.service';
import { SubscriptionPlansController } from '@app/finance/subscription-system/subscription-plans.controller';
import { UserSubscriptionsController } from '@app/finance/subscription-system/user-subscriptions.controller';
import { SubscriptionDownloadsController } from '@app/finance/subscription-system/subscription-downloads.controller';
import { SubscriptionSettlementsController } from '@app/finance/subscription-system/subscription-settlements.controller';

@Module({
  imports: [CatalogModule, ProductsModule],
  controllers: [
    SubscriptionPlansController,
    UserSubscriptionsController,
    SubscriptionDownloadsController,
    SubscriptionSettlementsController,
  ],
  providers: [
    SubscriptionPlansService,
    UserSubscriptionsService,
    SubscriptionDownloadsService,
    SubscriptionSettlementsService,
  ],
  exports: [UserSubscriptionsService],
})
export class SubscriptionSystemModule {}
