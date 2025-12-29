import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { EarningStatus, EntitlementSource, PayoutStatus } from '@app/finance/common/finance.enums';

export class SupplierReportQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ example: 'supplier-uuid' })
  @IsOptional()
  @IsString()
  supplierId?: string;
}

export class SupplierRevenueSummaryDto {
  @ApiProperty({ example: 1500000 })
  totalPaidSales!: number;

  @ApiProperty({ example: 500000 })
  totalSubscriptionEarnings!: number;

  @ApiProperty({ example: 1200000 })
  pendingAmount!: number;

  @ApiProperty({ example: 800000 })
  finalizedAmount!: number;
}

export class SupplierOrderRevenueDto {
  @ApiProperty({ example: 'order-uuid' })
  orderId!: string;

  @ApiProperty({ example: '1024' })
  productId!: string;

  @ApiProperty({ example: 250000 })
  amount!: number;

  @ApiProperty({ example: '2024-02-01T10:00:00.000Z' })
  paidAt!: string;

  @ApiPropertyOptional({ enum: PayoutStatus })
  payoutStatus?: PayoutStatus | null;
}

export class SupplierSubscriptionEarningDto {
  @ApiProperty({ example: 'earning-uuid' })
  id!: string;

  @ApiProperty({ example: 'pool-uuid' })
  poolId!: string;

  @ApiProperty({ example: '2024-01-01' })
  periodStart!: string;

  @ApiProperty({ example: '2024-01-31' })
  periodEnd!: string;

  @ApiProperty({ example: 120000 })
  amount!: number;

  @ApiProperty({ enum: EarningStatus })
  status!: EarningStatus;

  @ApiPropertyOptional({ enum: PayoutStatus })
  payoutStatus?: PayoutStatus | null;
}

export class SupplierDownloadLogDto {
  @ApiProperty({ example: 'log-uuid' })
  id!: string;

  @ApiProperty({ example: 'user-uuid' })
  userId!: string;

  @ApiProperty({ example: '1024' })
  productId!: string;

  @ApiProperty({ example: '2024-02-01T10:00:00.000Z' })
  dateTime!: string;

  @ApiProperty({ enum: EntitlementSource })
  source!: EntitlementSource;
}

export class PaginatedSupplierOrdersDto {
  @ApiProperty({ type: [SupplierOrderRevenueDto] })
  data!: SupplierOrderRevenueDto[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: false })
  hasNext!: boolean;
}

export class PaginatedSupplierSubscriptionEarningsDto {
  @ApiProperty({ type: [SupplierSubscriptionEarningDto] })
  data!: SupplierSubscriptionEarningDto[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: false })
  hasNext!: boolean;
}

export class PaginatedSupplierDownloadsDto {
  @ApiProperty({ type: [SupplierDownloadLogDto] })
  data!: SupplierDownloadLogDto[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: false })
  hasNext!: boolean;
}
