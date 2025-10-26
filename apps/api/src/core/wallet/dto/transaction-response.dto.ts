import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  WalletTransaction,
  WalletTransactionRefType,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../wallet-transaction.entity';

export class WalletTransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  walletId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  type: WalletTransactionType;

  @ApiProperty()
  status: WalletTransactionStatus;

  @ApiProperty()
  amount: string;

  @ApiProperty()
  refType: WalletTransactionRefType;

  @ApiPropertyOptional()
  refId: string | null;

  @ApiPropertyOptional()
  description: string | null;

  @ApiPropertyOptional({ type: Object })
  metadata: Record<string, unknown> | null;

  @ApiProperty()
  idempotencyKey: string;

  @ApiProperty()
  createdAt: Date;

  constructor(entity: WalletTransaction) {
    this.id = entity.id;
    this.walletId = entity.walletId;
    this.userId = entity.userId;
    this.type = entity.type;
    this.status = entity.status;
    this.amount = entity.amount;
    this.refType = entity.refType;
    this.refId = entity.refId ?? null;
    this.description = entity.description ?? null;
    this.metadata = entity.metadata ?? null;
    this.idempotencyKey = entity.idempotencyKey;
    this.createdAt = entity.createdAt;
  }
}
