import { ApiProperty } from '@nestjs/swagger';

export class SubscriptionDiscountStatsDto {
  @ApiProperty({
    example: 20,
    description: 'Percentage applied per discounted subscription purchase.',
  })
  discountPercent!: number;

  @ApiProperty({
    example: 20,
    description:
      'Total discounted purchases allowed per user for the lifetime of the subscription (not daily, not multiplied by duration).',
  })
  discountQuota!: number;

  @ApiProperty({ example: 7 })
  usedDiscounts!: number;

  @ApiProperty({ example: 13 })
  remainingDiscounts!: number;

  @ApiProperty({ example: true })
  isDiscountActive!: boolean;

  @ApiProperty({
    example: 'LIFETIME',
    enum: ['LIFETIME'],
    description: 'Discount quota applies to the lifetime of the subscription.',
  })
  quotaType!: 'LIFETIME';
}
