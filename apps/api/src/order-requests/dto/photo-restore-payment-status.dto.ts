import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderRequestPaymentFulfillmentStatus, PaymentStatus } from '@prisma/client';

export class PhotoRestorePaymentStatusDto {
  @ApiProperty({ example: 'payment-uuid' })
  paymentId!: string;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ enum: OrderRequestPaymentFulfillmentStatus })
  fulfillmentStatus!: OrderRequestPaymentFulfillmentStatus;

  @ApiPropertyOptional({ example: 'order-request-uuid', nullable: true })
  orderRequestId?: string | null;

  @ApiPropertyOptional({ example: '2025-01-01T12:05:00.000Z', nullable: true })
  fulfilledAt?: string | null;
}
