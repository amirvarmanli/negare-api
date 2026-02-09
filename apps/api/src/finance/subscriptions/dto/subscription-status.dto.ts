import { ApiProperty } from '@nestjs/swagger';

export class SubscriptionPlanSummaryDto {
  @ApiProperty({ example: '2f5a8f6b-1f2b-4b7b-9c52-9e7b0b7a5b0e' })
  id!: string;

  @ApiProperty({ example: 'Starter' })
  title!: string;

  @ApiProperty({ example: 5 })
  dailyDownloadLimit!: number;

  @ApiProperty({ example: 150000 })
  price!: number;

  @ApiProperty({ example: 30 })
  durationDays!: number;
}

export class SubscriptionStatusDto {
  @ApiProperty({ example: true })
  hasActiveSubscription!: boolean;

  @ApiProperty({ example: 3, nullable: true })
  remainingDailyDownloads!: number | null;

  @ApiProperty({ type: SubscriptionPlanSummaryDto, nullable: true })
  subscriptionPlan!: SubscriptionPlanSummaryDto | null;
}
