import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { FinanceWalletTransaction, NotificationType } from '@prisma/client';
import { WalletService } from './wallet.service';
import { NotificationsService } from '@app/notifications/notifications.service';
import { AllConfig } from '@app/config/config.module';
import { requestTraceStorage } from '@app/common/tracing/request-trace';
import {
  WalletTransactionReason,
  WalletTransactionStatus,
  WalletTransactionType,
} from '@app/finance/common/finance.enums';

describe('WalletService', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const baseTx: FinanceWalletTransaction = {
    id: 'tx-1',
    walletId: 'wallet-1',
    userId: 'platform-user',
    type: WalletTransactionType.CREDIT,
    reason: WalletTransactionReason.TOPUP,
    status: WalletTransactionStatus.PENDING,
    amount: 100000,
    balanceAfter: 200000,
    referenceId: 'payment-1',
    description: 'topup',
    idempotencyKey: 'payment:payment-1',
    createdAt,
    updatedAt: createdAt,
  };

  let notificationsService: Partial<NotificationsService>;
  let configService: Partial<ConfigService<AllConfig>>;

  const buildTx = (result: FinanceWalletTransaction): Prisma.TransactionClient => ({
    financeWalletTransaction: {
      create: jest.fn().mockResolvedValue(result),
    },
  } as unknown as Prisma.TransactionClient);

  beforeEach(() => {
    requestTraceStorage.enterWith({ traceId: 'trace-ctx' });
    notificationsService = {
      createNotification: jest.fn().mockResolvedValue('notif-id'),
      enqueueToUser: jest.fn().mockResolvedValue(undefined),
    };
    configService = {
      get: jest.fn((key: string) =>
        key === 'PLATFORM_WALLET_USER_ID' ? 'platform-owner' : undefined,
      ),
    };
  });

  const createService = () =>
    new WalletService(
      {} as any,
      notificationsService as NotificationsService,
      configService as ConfigService<AllConfig>,
    );

  it('notifies platform owner on wallet credit', async () => {
    const tx = buildTx({
      ...baseTx,
      type: WalletTransactionType.CREDIT,
      reason: WalletTransactionReason.TOPUP,
    });
    const service = createService();
    await service.createTransaction(tx, {
      walletId: 'wallet-1',
      userId: 'platform-user',
      type: WalletTransactionType.CREDIT,
      reason: WalletTransactionReason.TOPUP,
      amount: 100000,
      status: WalletTransactionStatus.PENDING,
      referenceId: 'payment-1',
      idempotencyKey: 'payment:payment-1',
      notificationMetadata: {
        paymentId: 'payment-1',
        actorUserId: 'platform-user',
        productId: '123',
      },
    });

    const notificationArg =
      (notificationsService.createNotification as jest.Mock).mock.calls[0][0];
    expect(notificationArg).toMatchObject({
      type: NotificationType.WALLET_TRANSACTION_RECORDED,
      title: 'افزایش موجودی کیف پول',
    });
    expect(notificationArg.body).toContain('دلیل: شارژ کیف پول');
    expect(notificationArg.body).not.toContain('TOPUP');
    expect(notificationArg.data).toMatchObject({
      type: WalletTransactionType.CREDIT,
      direction: 'increase',
      reason: WalletTransactionReason.TOPUP,
      paymentId: 'payment-1',
      displayReason: 'شارژ کیف پول',
    });
    expect(notificationsService.enqueueToUser).toHaveBeenCalledWith(
      'notif-id',
      'platform-owner',
      'wallet_tx:tx-1',
      expect.objectContaining({
        traceId: 'trace-ctx',
        walletTxId: 'tx-1',
        walletUserId: 'platform-user',
        reason: WalletTransactionReason.TOPUP,
        amount: 100000,
      }),
    );
  });

  it('uses debit template when transaction is a debit', async () => {
    const debitTx = buildTx({
      ...baseTx,
      id: 'tx-2',
      type: WalletTransactionType.DEBIT,
      reason: WalletTransactionReason.ORDER_PAYMENT,
    });
    const service = createService();
    await service.createTransaction(debitTx, {
      walletId: 'wallet-1',
      userId: 'platform-user',
      type: WalletTransactionType.DEBIT,
      reason: WalletTransactionReason.ORDER_PAYMENT,
      amount: 50000,
      referenceId: 'order-99',
      idempotencyKey: 'order:order-99',
      notificationMetadata: {
        orderId: 'order-99',
        actorUserId: 'platform-user',
      },
    });

    const notificationCall =
      (notificationsService.createNotification as jest.Mock).mock.calls[0][0];
    expect(notificationCall.body).toContain('دلیل: پرداخت سفارش');
    expect(notificationCall.body).not.toContain('ORDER_PAYMENT');
    expect(notificationCall.data).toMatchObject({
      displayReason: 'پرداخت سفارش',
    });
    expect(notificationsService.enqueueToUser).toHaveBeenCalledWith(
      'notif-id',
      'platform-owner',
      'wallet_tx:tx-2',
      expect.objectContaining({
        reason: WalletTransactionReason.ORDER_PAYMENT,
      }),
    );
  });

  it('does not notify when creating a duplicate wallet transaction fails', async () => {
    const tx = {
      financeWalletTransaction: {
        create: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: 'P2002' })),
      },
    } as unknown as Prisma.TransactionClient;
    const service = createService();
    await expect(
      service.createTransaction(tx, {
        walletId: 'wallet-1',
        userId: 'platform-user',
        type: WalletTransactionType.CREDIT,
        reason: WalletTransactionReason.TOPUP,
        amount: 100000,
      }),
    ).rejects.toThrow();
    expect(notificationsService.createNotification).not.toHaveBeenCalled();
    expect(notificationsService.enqueueToUser).not.toHaveBeenCalled();
  });

  it('throws if PLATFORM_WALLET_USER_ID is missing', async () => {
    configService.get = jest.fn().mockReturnValue(undefined);
    const tx = buildTx(baseTx);
    const service = createService();
    await expect(
      service.createTransaction(tx, {
        walletId: 'wallet-1',
        userId: 'platform-user',
        type: WalletTransactionType.CREDIT,
        reason: WalletTransactionReason.TOPUP,
        amount: 100000,
      }),
    ).rejects.toThrow(InternalServerErrorException);
    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });
});
