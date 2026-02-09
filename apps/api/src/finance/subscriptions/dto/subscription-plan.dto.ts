import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubscriptionPlanDto {
  @ApiProperty({ example: 'plan-uuid' })
  id!: string;

  @ApiProperty({ example: 'Starter' })
  title!: string;

  @ApiProperty({ example: 150000 })
  price!: number;

  @ApiProperty({ example: 30 })
  durationDays!: number;

  @ApiProperty({ example: 5 })
  dailyDownloadLimit!: number;

  @ApiProperty({ example: 10 })
  dailyFreeDownloadLimitWithSubscription!: number;

  @ApiProperty({ example: 'Basic plan description.' })
  description!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiPropertyOptional({
    example: 10,
    description: 'Percentage applied per discounted subscription purchase.',
  })
  discountPercent?: number | null;

  @ApiPropertyOptional({ example: [{ label: 'Premium exports' }] })
  features?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    example: 5,
    description:
      'Total discounted purchases allowed per user for the lifetime of the subscription (not daily, not per billing cycle).',
  })
  discountQuota?: number | null;

  @ApiProperty({
    example: 'LIFETIME',
    enum: ['LIFETIME'],
    description: 'Discount quota applies to the lifetime of the subscription.',
  })
  discountQuotaType!: 'LIFETIME';

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2025-01-02T00:00:00.000Z' })
  updatedAt!: string;
}
