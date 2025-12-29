import { ApiProperty } from '@nestjs/swagger';

export class SubscriptionPoolComputeResponseDto {
  @ApiProperty({ example: 'pool-uuid' })
  poolId!: string;

  @ApiProperty({ example: 1200000 })
  totalRevenue!: number;

  @ApiProperty({ example: 360000 })
  platformShareAmount!: number;

  @ApiProperty({ example: 840000 })
  distributableAmount!: number;

  @ApiProperty({ example: 12 })
  suppliersCount!: number;
}

export class SupplierEarningDto {
  @ApiProperty({ example: 'supplier-uuid' })
  supplierId!: string;

  @ApiProperty({ example: 12.5 })
  downloadsCredit!: number;

  @ApiProperty({ example: 150000 })
  amount!: number;
}
