import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionStatus } from '@app/finance/common/finance.enums';

export class SubscriptionMeDto {
  @ApiPropertyOptional({ example: 'subscription-uuid' })
  id?: string;

  @ApiPropertyOptional({ example: 'plan-uuid' })
  planId?: string;

  @ApiPropertyOptional({ example: 'Starter' })
  planTitle?: string;

  @ApiPropertyOptional({ example: 150000 })
  price?: number;

  @ApiPropertyOptional({ example: 30 })
  durationDays?: number;

  @ApiPropertyOptional({ example: 5 })
  dailySubscriptionDownloadLimit?: number;

  @ApiPropertyOptional({ example: 10 })
  dailyFreeDownloadLimitWithSubscription?: number;

  @ApiPropertyOptional({ enum: SubscriptionStatus })
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ example: '2024-01-01T00:00:00.000Z' })
  startAt?: string;

  @ApiPropertyOptional({ example: '2024-02-01T00:00:00.000Z' })
  endAt?: string;
}
