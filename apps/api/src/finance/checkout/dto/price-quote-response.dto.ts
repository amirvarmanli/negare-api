import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CheckoutItemResponseDto } from './checkout-item.dto';
import {
  CheckoutDiscountMetadataDto,
  CheckoutNonAppliedDiscountDto,
} from './discount-metadata.dto';

export class CheckoutPriceQuoteResponseDto {
  @ApiProperty({ type: [CheckoutItemResponseDto] })
  items!: CheckoutItemResponseDto[];

  @ApiProperty({ example: 200000 })
  subtotal!: number;

  @ApiProperty({ example: 20 })
  appliedDiscountPercent!: number;

  @ApiProperty({ example: 40000 })
  appliedDiscountAmount!: number;

  @ApiProperty({ example: 160000 })
  total!: number;

  @ApiProperty({
    enum: ['COUPON', 'SUBSCRIPTION', 'NONE'],
    example: 'COUPON',
  })
  appliedDiscountSource!: 'COUPON' | 'SUBSCRIPTION' | 'NONE';

  @ApiPropertyOptional({ example: 'WELCOME10' })
  appliedDiscountCode?: string;

  @ApiProperty({ example: 'Coupon WELCOME10 applied: 20% off' })
  appliedDiscountReason!: string;

  @ApiProperty({ type: [CheckoutNonAppliedDiscountDto] })
  nonAppliedDiscounts!: CheckoutNonAppliedDiscountDto[];

  @ApiProperty({ type: CheckoutDiscountMetadataDto })
  discountMetadata!: CheckoutDiscountMetadataDto;
}
