import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt } from 'class-validator';
import {
  SubscriptionPlanCode,
} from '@app/finance/common/finance.enums';
import { SUBSCRIPTION_DURATIONS_MONTHS } from '@app/finance/common/finance.constants';

export class PurchaseSubscriptionDto {
  @ApiProperty({ enum: SubscriptionPlanCode, example: SubscriptionPlanCode.A })
  @IsEnum(SubscriptionPlanCode)
  planCode!: SubscriptionPlanCode;

  @ApiProperty({ example: 3, enum: SUBSCRIPTION_DURATIONS_MONTHS })
  @IsInt()
  @IsIn(SUBSCRIPTION_DURATIONS_MONTHS)
  durationMonths!: (typeof SUBSCRIPTION_DURATIONS_MONTHS)[number];
}
