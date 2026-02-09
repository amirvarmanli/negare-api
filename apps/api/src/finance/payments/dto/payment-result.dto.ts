import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PaymentFulfillmentStatus,
  PaymentProvider,
  PaymentReferenceType,
  PaymentSource,
  PaymentStatus,
} from '@app/finance/common/finance.enums';

export enum PaymentResultPurpose {
  WALLET_TOPUP = 'wallet_topup',
  PRODUCT_PURCHASE = 'product_purchase',
  SUBSCRIPTION_PURCHASE = 'subscription_purchase',
  DONATION = 'donation',
  IMAGE_RESTORE_ORDER = 'image_restore_order',
}

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

export class PaymentResultCtaDto {
  @ApiProperty({ example: 'Go to Purchased Products' })
  label!: string;

  @ApiProperty({ example: '/panel/purchases/products' })
  href!: string;
}

export class PaymentResultItemDto {
  @ApiProperty({ example: '1' })
  productId!: string;

  @ApiProperty({ example: 'File A' })
  title!: string;

  @ApiProperty({ example: 1 })
  qty!: number;
}

export class PaymentResultDetailsDto {
  @ApiPropertyOptional({ example: 'order-uuid' })
  orderId?: string | null;

  @ApiPropertyOptional({ type: [PaymentResultItemDto] })
  items?: PaymentResultItemDto[];

  @ApiPropertyOptional({ example: true })
  downloadAllowed?: boolean;

  @ApiPropertyOptional({ example: 'subscription-uuid' })
  subscriptionId?: string | null;

  @ApiPropertyOptional({ example: 'plan-uuid' })
  planId?: string | null;

  @ApiPropertyOptional({ example: 'wallet-uuid' })
  walletId?: string | null;

  @ApiPropertyOptional({ example: 'donation-uuid' })
  donationId?: string | null;

  @ApiPropertyOptional({ example: 'custom-order-uuid' })
  customOrderId?: string | null;
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

  @ApiProperty({ enum: PaymentResultPurpose })
  purpose!: PaymentResultPurpose;

  @ApiProperty({
    example: { orderId: 'order-uuid' },
    description: 'Structured link to the business entity for this payment.',
  })
  purposeRef!: Record<string, string | null>;

  @ApiProperty({ example: '2026-02-04T10:12:30.000Z' })
  dateTime!: string;

  @ApiPropertyOptional({ example: 'A1B2C3', nullable: true })
  refId?: string | null;

  @ApiPropertyOptional({ example: 'XYZ-999', nullable: true })
  trackingCode?: string | null;

  @ApiPropertyOptional({ example: 'gateway_verification_failed', nullable: true })
  errorMessage?: string | null;

  @ApiProperty({ type: PaymentResultCtaDto })
  cta!: PaymentResultCtaDto;

  @ApiPropertyOptional({ type: PaymentResultDetailsDto })
  details?: PaymentResultDetailsDto;

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
