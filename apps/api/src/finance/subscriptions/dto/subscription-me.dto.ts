import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionPlanCode, SubscriptionStatus } from '@app/finance/common/finance.enums';

export class SubscriptionMeDto {
  @ApiPropertyOptional({ example: 'subscription-uuid' })
  id?: string;

  @ApiPropertyOptional({ enum: SubscriptionPlanCode })
  planCode?: SubscriptionPlanCode;

  @ApiPropertyOptional({ example: 2 })
  dailySubLimit?: number;

  @ApiPropertyOptional({ example: 15 })
  dailyFreeLimit?: number;

  @ApiPropertyOptional({ enum: SubscriptionStatus })
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ example: '2024-01-01T00:00:00.000Z' })
  startAt?: string;

  @ApiPropertyOptional({ example: '2024-02-01T00:00:00.000Z' })
  endAt?: string;
}
