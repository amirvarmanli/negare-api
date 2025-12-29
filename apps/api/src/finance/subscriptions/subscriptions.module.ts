import { Module } from '@nestjs/common';
import { SubscriptionsService } from '@app/finance/subscriptions/subscriptions.service';
import { SubscriptionsController } from '@app/finance/subscriptions/subscriptions.controller';
import { SubscriptionsPurchaseController } from '@app/finance/subscriptions/subscriptions.purchase.controller';

@Module({
  controllers: [SubscriptionsController, SubscriptionsPurchaseController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
