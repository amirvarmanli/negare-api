import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  WalletTransactionReason,
  WalletTransactionStatus,
  WalletTransactionType,
} from '@app/finance/common/finance.enums';
import type { PaginationMeta } from '@app/common/dto/pagination.dto';

export class WalletTransactionsQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 20, maximum: 50 })
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number;
}

export class WalletTransactionItemDto {
  @ApiProperty({ example: 'wallet-tx-uuid' })
  id!: string;

  @ApiProperty({ enum: WalletTransactionType })
  type!: WalletTransactionType;

  @ApiProperty({ enum: WalletTransactionReason })
  reason!: WalletTransactionReason;

  @ApiProperty({ enum: WalletTransactionStatus })
  status!: WalletTransactionStatus;

  @ApiProperty({ example: 200000 })
  amount!: number;

  @ApiProperty({ example: 150000, nullable: true })
  balanceAfter!: number | null;

  @ApiProperty({ example: 'payment-or-order-id', nullable: true })
  referenceId!: string | null;

  @ApiProperty({ example: 'Wallet topup via Zibal', nullable: true })
  description!: string | null;

  @ApiProperty({ example: '2025-01-01T12:00:00.000Z' })
  createdAt!: string;
}

export class WalletTransactionsResponseDto {
  @ApiProperty({ type: [WalletTransactionItemDto] })
  items!: WalletTransactionItemDto[];

  @ApiProperty()
  meta!: PaginationMeta;
}
