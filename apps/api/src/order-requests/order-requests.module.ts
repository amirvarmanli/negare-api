import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma/prisma.module';
import { PhotoRestoreController } from '@app/order-requests/order-requests.controller';
import { PhotoRestorePaymentsController } from '@app/order-requests/order-request-payments.controller';
import { OrderRequestsService } from '@app/order-requests/order-requests.service';
import { OrderRequestPaymentsService } from '@app/order-requests/order-request-payments.service';
import { ZibalGatewayService } from '@app/finance/payments/gateway/zibal.gateway';

@Module({
  imports: [PrismaModule],
  controllers: [PhotoRestoreController, PhotoRestorePaymentsController],
  providers: [
    OrderRequestsService,
    OrderRequestPaymentsService,
    ZibalGatewayService,
  ],
  exports: [OrderRequestPaymentsService],
})
export class OrderRequestsModule {}
