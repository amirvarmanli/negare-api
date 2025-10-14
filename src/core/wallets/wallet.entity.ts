import { Column, Entity, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '../../shared/base.entity';
import { User } from '../users/user.entity';
import { WalletTransaction } from '../wallet-transactions/wallet-transaction.entity';

export enum WalletCurrency {
  IRR = 'IRR',
}

@Entity({ name: 'wallets' })
export class Wallet extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ type: 'bigint', default: '0' })
  balance: string;

  @Column({
    type: 'enum',
    enum: WalletCurrency,
    enumName: 'wallet_currency_enum',
    default: WalletCurrency.IRR,
  })
  currency: WalletCurrency;

  @OneToOne(() => User, (user) => user.wallet, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(
    () => WalletTransaction,
    (transaction) => transaction.wallet,
  )
  transactions: WalletTransaction[];
}
