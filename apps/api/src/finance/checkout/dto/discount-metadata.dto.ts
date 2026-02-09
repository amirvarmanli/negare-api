import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CouponValueType } from '@app/finance/common/finance.enums';

export interface CheckoutNonAppliedDiscount {
  source: 'COUPON' | 'SUBSCRIPTION';
  code?: string;
  reason: string;
}

export interface CheckoutDiscountMetadata {
  subtotal: number;
  appliedDiscountSource: 'COUPON' | 'SUBSCRIPTION' | 'NONE';
  appliedDiscountPercent: number;
  appliedDiscountAmount: number;
  appliedDiscountCode?: string;
  appliedDiscountReason: string;
  couponId?: string;
  couponCode?: string;
  couponValueType?: CouponValueType;
  couponValue?: number;
  discountAmount: number;
  discountReason: string;
  subscriptionDiscountPercent?: number;
  subscriptionDiscountTotal?: number;
  subscriptionDiscountUsed?: number;
  subscriptionDiscountRemaining?: number;
  subscriptionDiscountQuotaType?: 'LIFETIME';
  nonAppliedDiscounts: CheckoutNonAppliedDiscount[];
}

export class CheckoutNonAppliedDiscountDto implements CheckoutNonAppliedDiscount {
  @ApiProperty({ enum: ['COUPON', 'SUBSCRIPTION'], example: 'COUPON' })
  source!: CheckoutNonAppliedDiscount['source'];

  @ApiPropertyOptional({ example: 'WELCOME10' })
  code?: string;

  @ApiProperty({ example: 'Coupon offers less than another promotion.' })
  reason!: string;
}

export class CheckoutDiscountMetadataDto implements CheckoutDiscountMetadata {
  @ApiProperty({ example: 200000 })
  subtotal!: number;

  @ApiProperty({ enum: ['COUPON', 'SUBSCRIPTION', 'NONE'], example: 'COUPON' })
  appliedDiscountSource!: 'COUPON' | 'SUBSCRIPTION' | 'NONE';

  @ApiProperty({ example: 20 })
  appliedDiscountPercent!: number;

  @ApiProperty({ example: 40000 })
  appliedDiscountAmount!: number;

  @ApiPropertyOptional({ example: 'WELCOME10' })
  appliedDiscountCode?: string;

  @ApiProperty({ example: 'Coupon WELCOME10 applied: 20% off' })
  appliedDiscountReason!: string;

  @ApiPropertyOptional({ example: 'coupon-uuid' })
  couponId?: string;

  @ApiPropertyOptional({ example: 'WELCOME10' })
  couponCode?: string;

  @ApiPropertyOptional({ enum: CouponValueType, example: CouponValueType.PERCENT })
  couponValueType?: CouponValueType;

  @ApiPropertyOptional({ example: 20 })
  couponValue?: number;

  @ApiProperty({ example: 40000 })
  discountAmount!: number;

  @ApiProperty({ example: 'Coupon WELCOME10 applied: 20% off' })
  discountReason!: string;

  @ApiPropertyOptional({ example: 20 })
  subscriptionDiscountPercent?: number;

  @ApiPropertyOptional({
    example: 10,
    description:
      'Total discounted purchases allowed per user for the lifetime of the subscription (not daily, not per billing cycle).',
  })
  subscriptionDiscountTotal?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Lifetime discounted purchases already used.',
  })
  subscriptionDiscountUsed?: number;

  @ApiPropertyOptional({
    example: 7,
    description: 'Remaining discounted purchases for the lifetime of the subscription.',
  })
  subscriptionDiscountRemaining?: number;

  @ApiPropertyOptional({
    example: 'LIFETIME',
    enum: ['LIFETIME'],
    description: 'Discount quota applies to the lifetime of the subscription.',
  })
  subscriptionDiscountQuotaType?: 'LIFETIME';

  @ApiProperty({ type: [CheckoutNonAppliedDiscountDto] })
  nonAppliedDiscounts!: CheckoutNonAppliedDiscountDto[];
}
