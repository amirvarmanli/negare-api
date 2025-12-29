import { Module } from '@nestjs/common';
import { PayoutsService } from '@app/finance/payouts/payouts.service';
import { PayoutsController } from '@app/finance/payouts/payouts.controller';

@Module({
  controllers: [PayoutsController],
  providers: [PayoutsService],
})
export class PayoutsModule {}
