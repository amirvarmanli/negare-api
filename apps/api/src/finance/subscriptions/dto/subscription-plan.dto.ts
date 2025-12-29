import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionPlanCode } from '@app/finance/common/finance.enums';

export class SubscriptionPlanDto {
  @ApiProperty({ example: 'plan-uuid' })
  id!: string;

  @ApiProperty({ enum: SubscriptionPlanCode })
  code!: SubscriptionPlanCode;

  @ApiProperty({ example: 2 })
  dailySubLimit!: number;

  @ApiProperty({ example: 15 })
  dailyFreeLimit!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;
}
