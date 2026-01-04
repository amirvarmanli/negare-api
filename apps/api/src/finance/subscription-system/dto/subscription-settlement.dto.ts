import { ApiProperty } from '@nestjs/swagger';

export class SubscriptionSettlementSupplierDto {
  @ApiProperty({ example: 'supplier-uuid' })
  supplierId!: string;

  @ApiProperty({ example: 12 })
  downloadCount!: number;

  @ApiProperty({ example: 42000 })
  amount!: number;
}

export class SubscriptionSettlementDto {
  @ApiProperty({ example: 'settlement-uuid' })
  id!: string;

  @ApiProperty({ example: 'subscription-uuid' })
  subscriptionId!: string;

  @ApiProperty({ example: 150000 })
  price!: number;

  @ApiProperty({ example: 20 })
  totalDownloads!: number;

  @ApiProperty({ example: 45000 })
  platformAmount!: number;

  @ApiProperty({ example: 105000 })
  supplierAmount!: number;

  @ApiProperty({ example: '2025-02-01T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ type: [SubscriptionSettlementSupplierDto] })
  suppliers!: SubscriptionSettlementSupplierDto[];
}

export class SubscriptionSettlementRunResultDto {
  @ApiProperty({ example: 2 })
  processed!: number;

  @ApiProperty({ type: [SubscriptionSettlementDto] })
  settlements!: SubscriptionSettlementDto[];
}
