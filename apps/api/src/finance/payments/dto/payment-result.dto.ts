import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PaymentFulfillmentStatus,
  PaymentProvider,
  PaymentPurpose,
  PaymentReferenceType,
  PaymentSource,
  PaymentStatus,
} from '@app/finance/common/finance.enums';

export enum PaymentResultIntent {
  PRODUCT = 'PRODUCT',
  SUBSCRIPTION = 'SUBSCRIPTION',
  PHOTO_RESTORE = 'PHOTO_RESTORE',
  DONATION = 'DONATION',
}

export enum PaymentResultNextAction {
  GO_TO_ORDER = 'GO_TO_ORDER',
  GO_TO_SUBSCRIPTION = 'GO_TO_SUBSCRIPTION',
  GO_TO_PHOTO_RESTORE = 'GO_TO_PHOTO_RESTORE',
  CONTACT_SUPPORT = 'CONTACT_SUPPORT',
  RETRY = 'RETRY',
  WAIT = 'WAIT',
}

export class PaymentResultDto {
  @ApiProperty({ example: 'payment-uuid' })
  paymentId!: string;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ enum: PaymentSource })
  source!: PaymentSource;

  @ApiProperty({ enum: PaymentProvider })
  provider!: PaymentProvider;

  @ApiProperty({ example: 250000 })
  amount!: number;

  @ApiProperty({ example: 'TOMAN' })
  currency!: string;

  @ApiProperty({ enum: PaymentPurpose })
  purpose!: PaymentPurpose | 'PHOTO_RESTORE';

  @ApiProperty({ enum: PaymentReferenceType })
  referenceType!: PaymentReferenceType | 'photo_restore';

  @ApiProperty({ example: 'reference-id' })
  referenceId!: string;

  @ApiProperty({ enum: PaymentResultIntent })
  intent!: PaymentResultIntent;

  @ApiProperty({
    enum: PaymentFulfillmentStatus,
    description: 'Indicates whether fulfillment has completed after payment.',
  })
  fulfillmentStatus!: PaymentFulfillmentStatus;

  @ApiPropertyOptional({ example: '2025-01-01T12:05:00.000Z', nullable: true })
  fulfilledAt?: string | null;

  @ApiPropertyOptional({ example: '2025-01-01T12:04:00.000Z', nullable: true })
  verifiedAt?: string | null;

  @ApiPropertyOptional({ example: '2025-01-01T12:04:00.000Z', nullable: true })
  paidAt?: string | null;

  @ApiPropertyOptional({ example: 'gateway_verification_failed', nullable: true })
  failureReason?: string | null;

  @ApiPropertyOptional({ example: 'entitlements_failed', nullable: true })
  fulfillmentError?: string | null;

  @ApiProperty({ example: false })
  retryable!: boolean;

  @ApiProperty({ enum: PaymentResultNextAction })
  recommendedNextAction!: PaymentResultNextAction;

  @ApiPropertyOptional({ example: 'پرداخت با موفقیت انجام شد.' })
  messageFa?: string;

  @ApiPropertyOptional({ example: 'order-uuid' })
  orderId?: string | null;

  @ApiPropertyOptional({ example: true })
  canAccessDownloads?: boolean;

  @ApiPropertyOptional({ example: 500000 })
  walletBalanceToman?: number;

  @ApiPropertyOptional({ example: 200000 })
  topupAmountToman?: number;
}
