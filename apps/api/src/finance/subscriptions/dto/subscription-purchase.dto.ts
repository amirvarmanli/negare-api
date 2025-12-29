import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class SubscriptionPurchaseDto {
  @ApiProperty({ example: 'subscription-plan-uuid' })
  @IsString()
  @MaxLength(64)
  planId!: string;
}

export class SubscriptionPurchaseResponseDto {
  @ApiProperty({ example: 'purchase-uuid' })
  purchaseId!: string;

  @ApiProperty({ example: 250000 })
  amount!: number;

  @ApiProperty({ example: 'Plan A' })
  planTitle!: string;
}
