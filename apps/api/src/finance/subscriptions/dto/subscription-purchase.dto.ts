import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { FinanceSubscriptionPurchaseStatus } from '@prisma/client';

export class SubscriptionPurchaseDto {
  @ApiProperty({
    example: 'subscription-plan-uuid',
    description:
      'Subscription plan ID from GET /subscriptions/plans (finance.subscription_plans_v2).',
  })
  @IsUUID()
  planId!: string;
}

export class SubscriptionPlanSummaryDto {
  @ApiProperty({ example: 'plan-uuid' })
  id!: string;

  @ApiProperty({ example: 'Starter' })
  title!: string;

  @ApiProperty({ example: 150000 })
  price!: number;

  @ApiProperty({ example: 30 })
  durationDays!: number;

  @ApiProperty({ example: 5 })
  dailySubscriptionDownloadLimit!: number;

  @ApiProperty({ example: 10 })
  dailyFreeDownloadLimitWithSubscription!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 'Basic plan description.' })
  description!: string | null;
}

export class SubscriptionPurchaseResponseDto {
  @ApiProperty({ example: 'purchase-uuid' })
  purchaseId!: string;

  @ApiProperty({ example: 150000 })
  amount!: number;

  @ApiProperty({ example: 'TOMAN' })
  currency!: string;

  @ApiProperty({ example: 30 })
  durationDays!: number;

  @ApiProperty({ example: 'Starter' })
  planTitle!: string;

  @ApiProperty({ enum: FinanceSubscriptionPurchaseStatus })
  status!: FinanceSubscriptionPurchaseStatus;

  @ApiProperty({ type: SubscriptionPlanSummaryDto })
  plan!: SubscriptionPlanSummaryDto;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  createdAt!: string;
}
