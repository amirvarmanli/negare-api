import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createTestDataSource } from '../../tests/utils/test-database.util';
import { UsersService } from '@app/core/users/users.service';
import { WalletsService } from '@app/core/wallet/wallets.service';
import { User } from '@app/core/users/user.entity';
import { Wallet } from '@app/core/wallet/wallet.entity';
import { WalletTransaction } from '../../core/wallet-transactions/wallet-transaction.entity';
import { UserRole } from '@app/core/roles/entities/role.entity';
import { Role } from '@app/core/roles/entities/role.entity';
import { WalletTransactionRefType } from '../../core/wallet-transactions/wallet-transaction.entity';
import { WalletAuditService } from '@app/core/wallet/wallet-audit.service';
import { WalletRateLimitService } from '@app/core/wallet/wallet-rate-limit.service';

describe('WalletsService', () => {
  let dataSource: DataSource;
  let service: WalletsService;
  let usersService: UsersService;
  let user: User;

  beforeEach(async () => {
    dataSource = await createTestDataSource({
      entities: [User, UserRole, Role, Wallet, WalletTransaction],
    });
    const configStub = {
      get: () => undefined,
    } as unknown as ConfigService;
    const auditStub = {
      log: async () => undefined,
    } as unknown as WalletAuditService;
    const rateLimitStub = {
      consume: async () => undefined,
    } as unknown as WalletRateLimitService;

    service = new WalletsService(
      dataSource.getRepository(Wallet),
      dataSource.getRepository(WalletTransaction),
      dataSource,
      configStub,
      auditStub,
      rateLimitStub,
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

    expect(String(tx.amount)).toEqual('10000.00');
    expect(tx.idempotencyKey).toEqual('credit-1');
    expect(tx.walletId).toBeDefined();

    const balance = await service.getBalance(user.id);
    expect(String(balance.balance)).toEqual('10000.00');
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
        code: 'INSUFFICIENT_FUNDS',
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
    expect(String(balance.balance)).toEqual('2000.00');
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

    expect(String(tx.amount)).toEqual('2000.00');
    expect(tx.type).toEqual('debit');

    const balance = await service.getBalance(user.id);
    expect(String(balance.balance)).toEqual('3000.00');
  });
});
