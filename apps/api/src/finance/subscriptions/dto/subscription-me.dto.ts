import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionStatus } from '@app/finance/common/finance.enums';

export class SubscriptionPlanDetailsDto {
  @ApiPropertyOptional({ example: 'plan-uuid' })
  id?: string;

  @ApiPropertyOptional({ example: 'Starter' })
  title?: string;

  @ApiPropertyOptional({ example: 150000 })
  price?: number;

  @ApiPropertyOptional({ example: 30 })
  durationDays?: number;

  @ApiPropertyOptional({ example: 5 })
  dailyDownloadLimit?: number;

  @ApiPropertyOptional({ example: 10 })
  dailyFreeDownloadLimitWithSubscription?: number;

  @ApiPropertyOptional({ example: 10 })
  discountPercent?: number | null;

  @ApiPropertyOptional({ example: [{ label: 'Premium exports' }] })
  features?: Record<string, unknown> | null;
}

export class SubscriptionQuotaDto {
  @ApiProperty({ example: 5 })
  downloadsLimitSnapshot!: number;

  @ApiProperty({ example: 2 })
  downloadsUsed!: number;

  @ApiProperty({ example: 3 })
  downloadsRemaining!: number;

  @ApiProperty({ example: '2026-02-05T00:00:00.000Z' })
  resetAt!: string;
}

export class SubscriptionDownloadLogItemDto {
  @ApiProperty({ example: '12345' })
  productId!: string;

  @ApiProperty({ example: '2026-02-04T10:15:00.000Z' })
  createdAt!: string;

  @ApiProperty({ enum: ['SUCCESS', 'FAILED'] })
  status!: 'SUCCESS' | 'FAILED';

  @ApiPropertyOptional({ example: 'DAILY_QUOTA_EXCEEDED' })
  failReason?: string | null;
}

export class SubscriptionPanelQuotaDto {
  @ApiProperty({ example: 10 })
  freeLimit!: number;

  @ApiProperty({ example: 2 })
  freeUsedToday!: number;

  @ApiProperty({ example: 8 })
  freeRemainingToday!: number;

  @ApiProperty({ example: 5 })
  subLimit!: number;

  @ApiProperty({ example: 1 })
  subUsedToday!: number;

  @ApiProperty({ example: 4 })
  subRemainingToday!: number;
}

export class SubscriptionPanelDiscountDto {
  @ApiProperty({
    example: 20,
    description: 'Percentage applied per discounted subscription purchase.',
  })
  discountPercent!: number;

  @ApiProperty({
    example: 10,
    deprecated: true,
    description: 'Deprecated. Use discountQuotaLifetime instead.',
  })
  discountQuotaTotal!: number;

  @ApiProperty({
    example: 3,
    deprecated: true,
    description: 'Deprecated. Use discountUsedLifetime instead.',
  })
  discountUsedInPeriod!: number;

  @ApiProperty({
    example: 7,
    deprecated: true,
    description: 'Deprecated. Use discountRemainingLifetime instead.',
  })
  discountRemainingInPeriod!: number;

  @ApiProperty({
    example: 10,
    description:
      'Total discounted purchases allowed per user for the lifetime of the subscription (not daily, not per billing cycle).',
  })
  discountQuotaLifetime!: number;

  @ApiProperty({ example: 3 })
  discountUsedLifetime!: number;

  @ApiProperty({ example: 7 })
  discountRemainingLifetime!: number;

  @ApiProperty({
    example: 'LIFETIME',
    enum: ['LIFETIME'],
    description: 'Discount quota applies to the lifetime of the subscription.',
  })
  quotaType!: 'LIFETIME';
}

export class SubscriptionPanelSummaryDto {
  @ApiPropertyOptional({ enum: SubscriptionStatus })
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ type: SubscriptionPlanDetailsDto })
  plan?: SubscriptionPlanDetailsDto;

  @ApiPropertyOptional({ example: '2024-01-01T00:00:00.000Z' })
  startAt?: string;

  @ApiPropertyOptional({ example: '2024-02-01T00:00:00.000Z' })
  expiresAt?: string;

  @ApiPropertyOptional({ example: true })
  isValid?: boolean;
}

export class SubscriptionMeDto {
  @ApiPropertyOptional({ example: 'subscription-uuid' })
  id?: string;

  @ApiPropertyOptional({ enum: SubscriptionStatus })
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ example: '2024-01-01T00:00:00.000Z' })
  startAt?: string;

  @ApiPropertyOptional({ example: '2024-02-01T00:00:00.000Z' })
  endAt?: string;

  @ApiPropertyOptional({ example: true })
  autoRenew?: boolean | null;

  @ApiPropertyOptional({ example: 20 })
  remainingDays?: number;

  @ApiPropertyOptional({ type: SubscriptionPlanDetailsDto })
  plan?: SubscriptionPlanDetailsDto;

  @ApiPropertyOptional({ type: SubscriptionQuotaDto })
  quota?: SubscriptionQuotaDto;

  @ApiPropertyOptional({ type: SubscriptionPanelQuotaDto })
  today?: SubscriptionPanelQuotaDto;

  @ApiPropertyOptional({ type: SubscriptionPanelDiscountDto })
  discount?: SubscriptionPanelDiscountDto;

  @ApiPropertyOptional({ type: SubscriptionPanelSummaryDto, nullable: true })
  subscription?: SubscriptionPanelSummaryDto | null;

  @ApiPropertyOptional({ type: [SubscriptionDownloadLogItemDto] })
  logs?: SubscriptionDownloadLogItemDto[];
}
