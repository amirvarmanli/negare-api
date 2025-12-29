import { ApiProperty } from '@nestjs/swagger';
import {
  PaymentProvider,
  PaymentReferenceType,
  PaymentStatus,
} from '@app/finance/common/finance.enums';

export class PaymentDetailDto {
  @ApiProperty({ example: 'payment-uuid' })
  id!: string;

  @ApiProperty({ nullable: true, example: 'order-uuid' })
  orderId!: string | null;

  @ApiProperty({ enum: PaymentReferenceType, nullable: true })
  referenceType!: PaymentReferenceType | null;

  @ApiProperty({ example: 'reference-id', nullable: true })
  referenceId!: string | null;

  @ApiProperty({ enum: PaymentProvider })
  provider!: PaymentProvider;

  @ApiProperty({
    enum: PaymentStatus,
    description: 'PENDING (awaiting gateway), SUCCESS, FAILED, CANCELED.',
  })
  status!: PaymentStatus;

  @ApiProperty({ example: 250000 })
  amount!: number;

  @ApiProperty({ example: 'TOMAN' })
  currency!: string;

  @ApiProperty({ example: 'ref_123', nullable: true })
  gatewayReferenceId!: string | null;

  @ApiProperty({ example: 'Bank declined', nullable: true })
  failureReason!: string | null;

  @ApiProperty({ example: '2025-01-01T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2025-01-01T12:05:00.000Z', nullable: true })
  paidAt!: string | null;
}
