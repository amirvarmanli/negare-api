import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createTestDataSource } from '../../tests/utils/test-database.util';
import { WalletTransactionsService } from '../../core/wallet-transactions/wallet-transactions.service';
import { WalletsService } from '@app/core/wallet/wallets.service';
import { UsersService } from '@app/core/users/users.service';
import { User } from '@app/core/users/user.entity';
import { UserRole } from '@app/core/roles/entities/role.entity';
import { Role } from '@app/core/roles/entities/role.entity';
import { Wallet } from '@app/core/wallet/wallet.entity';
import {
  WalletTransaction,
  WalletTransactionRefType,
  WalletTransactionType,
} from '../../core/wallet-transactions/wallet-transaction.entity';
import { WalletAuditService } from '@app/core/wallet/wallet-audit.service';
import { WalletRateLimitService } from '@app/core/wallet/wallet-rate-limit.service';

describe('WalletTransactionsService', () => {
  let dataSource: DataSource;
  let service: WalletTransactionsService;
  let walletsService: WalletsService;
  let usersService: UsersService;
  let user: User;

  beforeEach(async () => {
    dataSource = await createTestDataSource({
      entities: [User, UserRole, Role, Wallet, WalletTransaction],
    });
    service = new WalletTransactionsService(
      dataSource.getRepository(WalletTransaction),
    );
    const configStub = {
      get: () => undefined,
    } as unknown as ConfigService;
    const auditStub = {
      log: async () => undefined,
    } as unknown as WalletAuditService;
    const rateLimitStub = {
      consume: async () => undefined,
    } as unknown as WalletRateLimitService;

    walletsService = new WalletsService(
      dataSource.getRepository(Wallet),
      dataSource.getRepository(WalletTransaction),
      dataSource,
      configStub,
      auditStub,
      rateLimitStub,
    );
    usersService = new UsersService(dataSource.getRepository(User));

    user = await usersService.create({
      username: `transactions_user_${Date.now()}`,
      email: 'transactions@example.com',
    });
    await walletsService.createForUser(user.id);
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('filters transactions by user and type', async () => {
    const creditTx = await walletsService.credit(user.id, {
      amount: '7000',
      idempotencyKey: 'tx-credit-1',
      refType: WalletTransactionRefType.ORDER,
    });

    await walletsService.debit(user.id, {
      amount: '2000',
      idempotencyKey: 'tx-debit-1',
      refType: WalletTransactionRefType.PAYOUT,
    });

    const result = await service.findAll({
      userId: user.id,
      type: WalletTransactionType.CREDIT,
      limit: 10,
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(creditTx.id);
  });

  it('returns transactions scoped by wallet id', async () => {
    await walletsService.credit(user.id, {
      amount: '5000',
      idempotencyKey: 'tx-credit-2',
      refType: WalletTransactionRefType.ADJUSTMENT,
    });

    const wallet = await walletsService.findByUserId(user.id);
    const transactions = await service.findByWallet(wallet!.id, {
      limit: 5,
    });

    expect(transactions).toHaveLength(1);
    expect(transactions[0].walletId).toEqual(wallet!.id);
  });

  it('finds transactions by id and idempotency key', async () => {
    const tx = await walletsService.credit(user.id, {
      amount: '3000',
      idempotencyKey: 'tx-credit-3',
      refType: WalletTransactionRefType.ORDER,
    });

    const byId = await service.findById(tx.id);
    const byKey = await service.findByIdempotencyKey('tx-credit-3');

    expect(byId?.id).toEqual(tx.id);
    expect(byId?.userId).toEqual(user.id);
    expect(byKey?.id).toEqual(tx.id);
  });

  it('supports date range filtering', async () => {
    await walletsService.credit(user.id, {
      amount: '1000',
      idempotencyKey: 'tx-credit-4',
      refType: WalletTransactionRefType.ORDER,
    });

    const from = new Date(Date.now() + 1000).toISOString();

    const filtered = await service.findAll({
      userId: user.id,
      from,
    });

    expect(filtered).toHaveLength(0);
  });
});
