import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentInitResponseDto } from '@app/finance/payments/dto/payment-init.dto';
import {
  CheckoutDiscountMetadataDto,
  CheckoutNonAppliedDiscountDto,
} from './discount-metadata.dto';

export class CheckoutConfirmResponseDto {
  @ApiProperty({ example: 'order-uuid' })
  orderId!: string;

  @ApiProperty({ example: 200000 })
  total!: number;

  @ApiProperty({ example: 20 })
  appliedDiscountPercent!: number;

  @ApiProperty({ example: 40000 })
  appliedDiscountAmount!: number;

  @ApiProperty({
    enum: ['COUPON', 'SUBSCRIPTION', 'NONE'],
    example: 'SUBSCRIPTION',
  })
  appliedDiscountSource!: 'COUPON' | 'SUBSCRIPTION' | 'NONE';

  @ApiPropertyOptional({ example: 'WELCOME10' })
  appliedDiscountCode?: string;

  @ApiProperty({ example: 'Subscription discount (Gold): 15% off (remaining 2 uses)' })
  appliedDiscountReason!: string;

  @ApiProperty({ type: [CheckoutNonAppliedDiscountDto] })
  nonAppliedDiscounts!: CheckoutNonAppliedDiscountDto[];

  @ApiProperty({ type: CheckoutDiscountMetadataDto })
  discountMetadata!: CheckoutDiscountMetadataDto;

  @ApiProperty({ type: PaymentInitResponseDto })
  payment!: PaymentInitResponseDto;
}
