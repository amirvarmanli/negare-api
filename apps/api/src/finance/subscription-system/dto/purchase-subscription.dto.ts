import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class PurchaseSubscriptionDto {
  @ApiProperty({ example: 'plan-uuid' })
  @IsUUID()
  planId!: string;
}
