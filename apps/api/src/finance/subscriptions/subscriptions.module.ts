import { Module } from '@nestjs/common';
import { SubscriptionsService } from '@app/finance/subscriptions/subscriptions.service';
import { SubscriptionsController } from '@app/finance/subscriptions/subscriptions.controller';
import { SubscriptionsPurchaseController } from '@app/finance/subscriptions/subscriptions.purchase.controller';
import { SubscriptionPanelController } from '@app/finance/subscriptions/subscription-panel.controller';

@Module({
  controllers: [
    SubscriptionsController,
    SubscriptionsPurchaseController,
    SubscriptionPanelController,
  ],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
