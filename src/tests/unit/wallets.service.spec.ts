import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestDataSource } from '../../tests/utils/test-database.util';
import { UsersService } from '../../core/users/users.service';
import { WalletsService } from '../../core/wallets/wallets.service';
import { User } from '../../core/users/user.entity';
import { Wallet } from '../../core/wallets/wallet.entity';
import { WalletTransaction } from '../../core/wallet-transactions/wallet-transaction.entity';
import { UserRole } from '../../core/user-roles/user-role.entity';
import { Role } from '../../core/roles/role.entity';
import { WalletTransactionRefType } from '../../core/wallet-transactions/wallet-transaction.entity';

describe('WalletsService', () => {
  let dataSource: DataSource;
  let service: WalletsService;
  let usersService: UsersService;
  let user: User;

  beforeEach(async () => {
    dataSource = await createTestDataSource({
      entities: [User, UserRole, Role, Wallet, WalletTransaction],
    });
    service = new WalletsService(
      dataSource.getRepository(Wallet),
      dataSource.getRepository(WalletTransaction),
      dataSource,
    );
    usersService = new UsersService(dataSource.getRepository(User));

    user = await usersService.create({
      username: `wallet_user_${Date.now()}`,
      email: 'wallet@example.com',
    });
    await service.createForUser(user.id, { });
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('credits wallet balance and records transaction atomically', async () => {
    const tx = await service.credit(user.id, {
      amount: '10000',
      idempotencyKey: 'credit-1',
      refType: WalletTransactionRefType.ORDER,
      refId: 'order-1',
      description: 'Initial top-up',
      metadata: { source: 'test' },
    });

    expect(String(tx.amount)).toEqual('10000');
    expect(tx.idempotencyKey).toEqual('credit-1');
    expect(tx.walletId).toBeDefined();

    const balance = await service.getBalance(user.id);
    expect(String(balance.balance)).toEqual('10000');
  });

  it('prevents overdraft with descriptive error', async () => {
    await expect(
      service.debit(user.id, {
        amount: '500',
        idempotencyKey: 'debit-1',
        refType: WalletTransactionRefType.PAYOUT,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'INSUFFICIENT_BALANCE',
      },
    });
  });

  it('ensures idempotent processing using idempotency key', async () => {
    await service.credit(user.id, {
      amount: '2000',
      idempotencyKey: 'credit-dup',
      refType: WalletTransactionRefType.ADJUSTMENT,
    });

    const secondCall = await service.credit(user.id, {
      amount: '2000',
      idempotencyKey: 'credit-dup',
      refType: WalletTransactionRefType.ADJUSTMENT,
    });

    const balance = await service.getBalance(user.id);
    expect(String(balance.balance)).toEqual('2000');
    expect(secondCall.idempotencyKey).toEqual('credit-dup');
  });

  it('debits wallet when sufficient balance exists', async () => {
    await service.credit(user.id, {
      amount: '5000',
      idempotencyKey: 'credit-for-debit',
      refType: WalletTransactionRefType.ORDER,
    });

    const tx = await service.debit(user.id, {
      amount: '2000',
      idempotencyKey: 'debit-2',
      refType: WalletTransactionRefType.PAYOUT,
      description: 'Payout to supplier',
    });

    expect(String(tx.amount)).toEqual('2000');
    expect(tx.type).toEqual('debit');

    const balance = await service.getBalance(user.id);
    expect(String(balance.balance)).toEqual('3000');
  });
});
