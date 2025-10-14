import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../shared/base.entity';
import { Wallet } from '../wallets/wallet.entity';
import { User } from '../users/user.entity';

export enum WalletTransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export enum WalletTransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum WalletTransactionRefType {
  ORDER = 'order',
  PAYOUT = 'payout',
  ADJUSTMENT = 'adjustment',
}

@Index('IDX_wallet_transactions_created_at', ['createdAt'])
@Entity({ name: 'wallet_transactions' })
export class WalletTransaction extends BaseEntity {
  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId: string;

  @Index('IDX_wallet_transactions_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: WalletTransactionType,
    enumName: 'wallet_transaction_type_enum',
  })
  type: WalletTransactionType;

  @Column({
    type: 'enum',
    enum: WalletTransactionStatus,
    enumName: 'wallet_transaction_status_enum',
    default: WalletTransactionStatus.PENDING,
  })
  status: WalletTransactionStatus;

  @Column({ type: 'bigint' })
  amount: string;

  @Column({
    name: 'ref_type',
    type: 'enum',
    enum: WalletTransactionRefType,
    enumName: 'wallet_transaction_ref_type_enum',
  })
  refType: WalletTransactionRefType;

  @Column({ name: 'ref_id', type: 'varchar', nullable: true })
  refId: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 128,
    unique: true,
  })
  idempotencyKey: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @ManyToOne(() => Wallet, (wallet) => wallet.transactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;

  @ManyToOne(() => User, (user) => user.walletTransactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
