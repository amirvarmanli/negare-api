import { Module } from '@nestjs/common';
import { DonationsController } from '@app/finance/donations/donations.controller';
import { DonationsService } from '@app/finance/donations/donations.service';
import { PAYMENT_GATEWAY } from '@app/finance/payments/gateway/gateway.interface';
import { ZibalGatewayService } from '@app/finance/payments/gateway/zibal.gateway';

@Module({
  controllers: [DonationsController],
  providers: [
    DonationsService,
    {
      provide: PAYMENT_GATEWAY,
      useClass: ZibalGatewayService,
    },
  ],
  exports: [DonationsService],
})
export class DonationsModule {}
