import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionStatus } from '@app/finance/subscription-system/subscription-system.enums';

export class UserSubscriptionDto {
  @ApiProperty({ example: 'subscription-uuid' })
  id!: string;

  @ApiProperty({ example: 'plan-uuid' })
  planId!: string;

  @ApiProperty({ example: 'Starter' })
  planTitle!: string;

  @ApiProperty({ example: 150000 })
  price!: number;

  @ApiProperty({ example: 30 })
  durationDays!: number;

  @ApiProperty({ example: 5 })
  dailyDownloadLimit!: number;

  @ApiProperty({ example: 10 })
  dailyFreeDownloadLimitWithSubscription!: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Percentage applied per discounted subscription purchase.',
  })
  discountPercent?: number | null;

  @ApiProperty({
    example: 10,
    description:
      'Remaining discounted purchases for the lifetime of this subscription (not daily, not per billing cycle).',
  })
  discountRemaining!: number;

  @ApiProperty({ enum: SubscriptionStatus })
  status!: SubscriptionStatus;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  startAt!: string;

  @ApiProperty({ example: '2025-01-31T00:00:00.000Z' })
  endAt!: string;
}
