import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import {
  OrderKind,
  OrderStatus,
  PaymentStatus,
  WalletTransactionReason,
} from '@app/finance/common/finance.enums';
import { PaymentsService } from '@app/finance/payments/payments.service';
import { EntitlementsService } from '@app/finance/entitlements/entitlements.service';
import { CartService } from '@app/finance/cart/cart.service';
import { PaymentGateway } from '@app/finance/payments/gateway/gateway.interface';
import { MockGatewayService } from '@app/finance/payments/gateway/mock-gateway.service';
import { WalletService } from '@app/finance/wallet/wallet.service';
import { RevenueService } from '@app/finance/revenue/revenue.service';
import { ProductsService } from '@app/finance/products/products.service';
import { SubscriptionsService } from '@app/finance/subscriptions/subscriptions.service';
import { DiscountsService } from '@app/finance/discounts/discounts.service';
import { DonationsService } from '@app/finance/donations/donations.service';
import { NotificationsService } from '@app/notifications/notifications.service';
import { PrismaService } from '@app/prisma/prisma.service';
import type { FinanceOrder } from '@prisma/client';

describe('PaymentsService wallet payments', () => {
  let service: PaymentsService;
  let prisma: Partial<PrismaService>;
  let walletService: Partial<WalletService>;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
    } as Partial<PrismaService>;
    walletService = {
      getOrCreateWalletInTransaction: jest.fn(),
      createTransaction: jest.fn(),
    };
    const configService = {
      get: jest.fn(),
    } as Partial<ConfigService<unknown>>;

    service = new PaymentsService(
      prisma as PrismaService,
      {} as PaymentGateway,
      {} as MockGatewayService,
      configService as ConfigService<unknown>,
      walletService as WalletService,
      {} as EntitlementsService,
      {} as RevenueService,
      {} as ProductsService,
      {} as SubscriptionsService,
      {} as DiscountsService,
      {} as CartService,
      {} as DonationsService,
      {} as NotificationsService,
    );
    service['entitlementsService'] = {
      grantPurchaseEntitlements: jest.fn().mockResolvedValue(undefined),
    } as EntitlementsService;
  });

  it('creates a successful payment when wallet checkout succeeds', async () => {
    const order: FinanceOrder = {
      id: 'order-1',
      userId: 'user-1',
      status: OrderStatus.PENDING_PAYMENT,
      orderKind: OrderKind.PRODUCT,
      total: 120000,
    } as FinanceOrder;

    const tx = {
      financeOrder: {
        findUnique: jest.fn(async () => order),
      },
      financePayment: {
        create: jest.fn(async () => ({
          id: 'payment-1',
          orderId: order.id,
          userId: order.userId,
          status: PaymentStatus.SUCCESS,
          amount: order.total,
        })),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        cb(tx as Prisma.TransactionClient),
    );
    jest
      .spyOn(service as any, 'applyWalletDebit')
      .mockResolvedValue({ walletId: 'w1', newBalance: 0, transactionId: 'tx', alreadyProcessed: false });
    jest
      .spyOn(service as any, 'ensureOrderNotExpired')
      .mockResolvedValue(undefined);
    const fulfillSpy = jest
      .spyOn(service as any, 'fulfillPayment')
      .mockResolvedValue(undefined);

    const result = await service.payOrderWithWallet('user-1', 'order-1');

    expect(result.status).toBe(PaymentStatus.SUCCESS);
    expect(result.id).toBe('payment-1');
    expect(fulfillSpy).toHaveBeenCalled();
  });

  it('returns the existing successful payment when the order is already paid', async () => {
    const order: FinanceOrder = {
      id: 'order-2',
      userId: 'user-2',
      status: OrderStatus.PAID,
      orderKind: OrderKind.PRODUCT,
      total: 50000,
    } as FinanceOrder;

    const tx = {
      financeOrder: {
        findUnique: jest.fn(async () => order),
      },
      financePayment: {
        findFirst: jest.fn(async () => ({
          id: 'payment-existing',
          orderId: order.id,
          userId: order.userId,
          status: PaymentStatus.SUCCESS,
          amount: order.total,
        })),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        cb(tx as Prisma.TransactionClient),
    );
    jest
      .spyOn(service as any, 'ensureOrderNotExpired')
      .mockResolvedValue(undefined);
    const fulfillSpy = jest
      .spyOn(service as any, 'fulfillPayment')
      .mockResolvedValue(undefined);

    const result = await service.payOrderWithWallet('user-2', 'order-2');

    expect(result.status).toBe(PaymentStatus.SUCCESS);
    expect(result.id).toBe('payment-existing');
    expect(fulfillSpy).not.toHaveBeenCalled();
  });

  it('throws Persian error when wallet balance is insufficient', async () => {
    const tx = {
      financeWallet: {
        updateMany: jest.fn(async () => ({ count: 0 })),
        findUniqueOrThrow: jest.fn(async () => ({ id: 'wallet-1', balance: 0 })),
      },
      financeWalletTransaction: {
        update: jest.fn(),
      },
    };
    (walletService.getOrCreateWalletInTransaction as jest.Mock).mockResolvedValue({
      id: 'wallet-1',
      status: 'ACTIVE',
      balance: 0,
    });
    (walletService.createTransaction as jest.Mock).mockResolvedValue({
      id: 'tx-1',
      status: 'PENDING',
    });

    await expect(
      (service as any).applyWalletDebit(tx as Prisma.TransactionClient, {
        userId: 'user-1',
        amount: 100000,
        reason: WalletTransactionReason.ORDER_PAYMENT,
        referenceId: 'order-1',
        idempotencyKey: 'order:order-1',
      }),
    ).rejects.toThrow('موجودی کیف پول کافی نیست.');
  });

  it('processes a wallet donation with idempotency', async () => {
    const tx = {
      financeWalletTransaction: {
        findFirst: jest.fn(async () => null),
      },
      financeDonation: {
        create: jest.fn(async () => ({ id: 'donation-1' })),
      },
      financePayment: {
        create: jest.fn(async () => ({
          id: 'payment-1',
          referenceId: 'donation-1',
          status: PaymentStatus.SUCCESS,
          fulfillmentStatus: 'PENDING',
        })),
        findUniqueOrThrow: jest.fn(async () => ({
          id: 'payment-1',
          referenceId: 'donation-1',
          status: PaymentStatus.SUCCESS,
          fulfillmentStatus: 'SUCCESS',
        })),
      },
    };

    (walletService.getOrCreateWalletInTransaction as jest.Mock).mockResolvedValue({
      id: 'wallet-1',
      status: 'ACTIVE',
      balance: 500000,
    });
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        cb(tx as Prisma.TransactionClient),
    );

    jest
      .spyOn(service as any, 'applyWalletDebit')
      .mockResolvedValue({ walletId: 'w1', newBalance: 300000, transactionId: 'tx', alreadyProcessed: false });
    jest
      .spyOn(service as any, 'fulfillPaymentSafely')
      .mockResolvedValue(undefined);

    const result = await service.payDonationWithWallet(
      'user-1',
      200000,
      'donation-req-1',
    );

    expect(result.donationId).toBe('donation-1');
    expect(result.payment.id).toBe('payment-1');
  });

  it('processes a subscription wallet payment', async () => {
    const purchase = {
      id: 'purchase-1',
      userId: 'user-1',
      status: 'PENDING',
      amount: 150000,
      subscriptionPlanId: 'plan-1',
      durationMonths: 1,
    };
    const tx = {
      financeSubscriptionPurchase: {
        findUnique: jest.fn(async () => purchase),
        update: jest.fn(async () => ({ ...purchase, status: 'PAID' })),
      },
      financePayment: {
        create: jest.fn(async () => ({
          id: 'payment-1',
          referenceId: 'purchase-1',
          status: PaymentStatus.SUCCESS,
        })),
        update: jest.fn(async () => ({
          id: 'payment-1',
          referenceId: 'purchase-1',
          status: PaymentStatus.SUCCESS,
          fulfillmentStatus: 'SUCCESS',
        })),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        cb(tx as Prisma.TransactionClient),
    );
    jest
      .spyOn(service as any, 'applyWalletDebit')
      .mockResolvedValue({ walletId: 'w1', newBalance: 0, transactionId: 'tx', alreadyProcessed: false });
    service['subscriptionsService'] = {
      activateSubscriptionFromPurchase: jest.fn().mockResolvedValue(undefined),
    } as SubscriptionsService;

    const result = await service.payWithWalletForReference(
      'user-1',
      'subscription',
      'purchase-1',
    );

    expect(result.receiptId).toBe('purchase-1');
    expect(
      service['subscriptionsService'].activateSubscriptionFromPurchase,
    ).toHaveBeenCalled();
  });
});
