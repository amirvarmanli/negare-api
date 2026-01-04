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
  dailySubscriptionDownloadLimit!: number;

  @ApiProperty({ example: 10 })
  dailyFreeDownloadLimitWithSubscription!: number;

  @ApiProperty({ example: 'Basic plan description.' })
  description!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiPropertyOptional({ example: 10 })
  discountPercent?: number | null;

  @ApiPropertyOptional({ example: 10 })
  discountQuota?: number | null;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2025-01-02T00:00:00.000Z' })
  updatedAt!: string;
}
