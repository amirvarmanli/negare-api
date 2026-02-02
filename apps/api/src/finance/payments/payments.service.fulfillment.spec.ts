import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import {
  CartStatus,
  OrderKind,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  WalletTransactionReason,
} from '@app/finance/common/finance.enums';
import { NotificationType } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { EntitlementsService } from '@app/finance/entitlements/entitlements.service';
import { CartService } from '@app/finance/cart/cart.service';
import type { FinanceOrder, FinanceOrderItem, FinancePayment } from '@prisma/client';
import { requestTraceStorage } from '@app/common/tracing/request-trace';
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

describe('PaymentsService fulfillment', () => {
  let service: PaymentsService;
  let entitlementsService: Partial<EntitlementsService>;
  let cartService: Partial<CartService>;
  let notificationsService: Partial<NotificationsService>;
  let configService: Partial<ConfigService<unknown>>;

  beforeEach(() => {
    requestTraceStorage.enterWith({ traceId: 'trace-ctx' });
    entitlementsService = {
      grantPurchaseEntitlements: jest.fn().mockResolvedValue(undefined),
    };
    cartService = {
      clearCartInTransaction: jest.fn().mockResolvedValue(undefined),
    };
    notificationsService = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    };
    configService = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'PLATFORM_COMMISSION_PERCENT':
            return 30;
          case 'SUPPLIER_REVENUE_PERCENT':
            return 70;
          case 'PLATFORM_WALLET_USER_ID':
            return 'platform-user';
          case 'PLATFORM_WALLET_ALLOW_NEGATIVE':
            return false;
          case 'GLOBAL_PREFIX':
            return '';
          default:
            return undefined;
        }
      }),
    };
    service = new PaymentsService(
      {} as PrismaService,
      {} as PaymentGateway,
      {} as MockGatewayService,
      configService as ConfigService<unknown>,
      {} as WalletService,
      entitlementsService as EntitlementsService,
      {} as RevenueService,
      {} as ProductsService,
      {} as SubscriptionsService,
      {} as DiscountsService,
      cartService as CartService,
      {} as DonationsService,
      notificationsService as NotificationsService,
    );
    service['cartService'] = cartService as CartService;
    service['notificationsService'] = notificationsService as NotificationsService;
    service['subscriptionsService'] = {
      activateSubscriptionFromPurchase: jest.fn().mockResolvedValue(undefined),
    } as SubscriptionsService;
    (service as any).applyOrderRevenueSplitAndCredits = jest
      .fn()
      .mockResolvedValue(undefined);
    (service as any).applySubscriptionDiscountUsage = jest
      .fn()
      .mockResolvedValue(undefined);
  });

  it('marks order paid, grants entitlements, and clears cart on success', async () => {
    const orderItem: FinanceOrderItem = {
      id: 'item-1',
      orderId: 'order-123',
      productId: 123n,
      unitPriceSnapshot: 1000,
      quantity: 1,
      lineTotal: 1000,
      productTypeSnapshot: 'PAID',
    } as FinanceOrderItem;

    const orderState: FinanceOrder = {
      id: 'order-123',
      userId: 'user-1',
      status: OrderStatus.PENDING_PAYMENT,
      orderKind: OrderKind.PRODUCT,
    } as unknown as FinanceOrder;

    const tx = {
      financeOrder: {
        findUnique: jest.fn(async () => orderState),
        update: jest.fn(async ({ data }) => {
          Object.assign(orderState, data);
          return orderState;
        }),
      },
      financeOrderItem: {
        findMany: jest.fn(async () => [orderItem]),
      },
      financeCart: {
        findFirst: jest.fn(async () => ({ id: 'cart-1', userId: 'user-1' })),
      },
      financeCartItem: {
        count: jest.fn(async () => 2),
      },
    } as unknown as Prisma.TransactionClient;

    const payment: FinancePayment = {
      id: 'payment-1',
      userId: 'user-1',
      orderId: 'order-123',
      meta: null,
    } as FinancePayment;

    await (service as any).fulfillOrderPayment(tx, payment);

    expect(entitlementsService.grantPurchaseEntitlements).toHaveBeenCalled();
    expect(cartService.clearCartInTransaction).toHaveBeenCalledWith(
      tx,
      'cart-1',
      CartStatus.CHECKED_OUT,
    );
  });

  it('is idempotent when called twice', async () => {
    const orderItem: FinanceOrderItem = {
      id: 'item-2',
      orderId: 'order-abc',
      productId: 456n,
      unitPriceSnapshot: 2000,
      quantity: 1,
      lineTotal: 2000,
      productTypeSnapshot: 'PAID',
    } as FinanceOrderItem;

    const orderState: FinanceOrder = {
      id: 'order-abc',
      userId: 'user-1',
      status: OrderStatus.PENDING_PAYMENT,
      orderKind: OrderKind.PRODUCT,
    } as unknown as FinanceOrder;

    const tx = {
      financeOrder: {
        findUnique: jest.fn(async () => orderState),
        update: jest.fn(async ({ data }) => {
          Object.assign(orderState, data);
          return orderState;
        }),
      },
      financeOrderItem: {
        findMany: jest.fn(async () => [orderItem]),
      },
      financeCart: {
        findFirst: jest.fn(async () => ({ id: 'cart-2', userId: 'user-1' })),
      },
      financeCartItem: {
        count: jest.fn(async () => 1),
      },
    } as unknown as Prisma.TransactionClient;

    const payment: FinancePayment = {
      id: 'payment-2',
      userId: 'user-1',
      orderId: 'order-abc',
      meta: null,
    } as FinancePayment;

    await (service as any).fulfillOrderPayment(tx, payment);
    await (service as any).fulfillOrderPayment(tx, payment);

    expect(entitlementsService.grantPurchaseEntitlements).toHaveBeenCalled();
    expect(cartService.clearCartInTransaction).toHaveBeenCalled();
  });

  it('funds platform wallet for coupon discounts and notifies admin', async () => {
    const orderItem: FinanceOrderItem = {
      id: 'item-3',
      orderId: 'order-coupon',
      productId: 789n,
      unitPriceSnapshot: 1200,
      quantity: 1,
      lineTotal: 1200,
      productTypeSnapshot: 'PAID',
    } as FinanceOrderItem;

    const orderState: FinanceOrder = {
      id: 'order-coupon',
      userId: 'user-1',
      status: OrderStatus.PENDING_PAYMENT,
      orderKind: OrderKind.PRODUCT,
      total: 1100,
      discountAmount: 100,
      discountSource: 'COUPON',
      couponCode: 'WELCOME10',
    } as unknown as FinanceOrder;

    const tx = {
      financeOrder: {
        findUnique: jest.fn(async () => orderState),
        update: jest.fn(async ({ data }) => {
          Object.assign(orderState, data);
          return orderState;
        }),
      },
      financeOrderItem: {
        findMany: jest.fn(async () => [orderItem]),
      },
      financeCart: {
        findFirst: jest.fn(async () => ({ id: 'cart-3', userId: 'user-1' })),
      },
      financeCartItem: {
        count: jest.fn(async () => 3),
      },
      user: {
        findUnique: jest.fn(async () => ({
          id: 'user-1',
          name: 'Buyer Name',
          firstName: 'Buyer',
          lastName: 'One',
          username: 'buyer',
          email: 'buyer@example.com',
          phone: '+989000000000',
        })),
      },
      product: {
        findMany: jest.fn(async () => [
          { id: 789n, title: 'Test Product', slug: 'test-product' },
        ]),
      },
    } as unknown as Prisma.TransactionClient;

    const payment: FinancePayment = {
      id: 'payment-3',
      userId: 'user-1',
      orderId: 'order-coupon',
      meta: null,
    } as FinancePayment;

    const walletDebitSpy = jest
      .spyOn(service as any, 'applyWalletDebit')
      .mockResolvedValue({
        walletId: 'platform-wallet',
        newBalance: 500000,
        transactionId: 'wallet-tx-platform',
        alreadyProcessed: false,
      });

    await (service as any).fulfillOrderPayment(tx, payment);

    expect(walletDebitSpy).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        userId: 'platform-user',
        amount: 100,
        reason: WalletTransactionReason.PLATFORM_DISCOUNT,
        referenceId: 'order-coupon',
        idempotencyKey: 'order:order-coupon:platform-discount',
      }),
      false,
    );
    const notificationSpy = notificationsService.createNotification as jest.MockedFunction<
      NotificationsService['createNotification']
    >;
    expect(notificationSpy).toHaveBeenCalledTimes(1);
    const notificationPayload = notificationSpy.mock.calls[0][0] as {
      type: NotificationType;
      data: any;
    };
    expect(notificationPayload.type).toBe(
      NotificationType.PLATFORM_DISCOUNT_APPLIED,
    );
    expect(notificationPayload.data?.links?.order).toBe(
      '/admin/orders/order-coupon',
    );
    expect(notificationPayload.data?.links?.products?.[0]?.url).toBe(
      '/products/test-product',
    );

    walletDebitSpy.mockRestore();
  });

  it('fulfills a subscription purchase after payment success', async () => {
    const tx = {
      financeSubscriptionPurchase: {
        findUnique: jest.fn(async () => ({
          id: 'purchase-1',
          userId: 'user-1',
          status: 'PENDING',
          subscriptionPlanId: 'plan-1',
          durationMonths: 1,
        })),
        update: jest.fn(async ({ data }) => ({ id: 'purchase-1', ...data })),
      },
    } as unknown as Prisma.TransactionClient;

    const payment: FinancePayment = {
      id: 'payment-sub',
      userId: 'user-1',
      orderId: null,
      referenceType: 'subscription',
      referenceId: 'purchase-1',
      meta: { subscriptionPurchaseId: 'purchase-1' },
    } as FinancePayment;

    await (service as any).fulfillPayment(tx, payment);

    expect(
      service['subscriptionsService'].activateSubscriptionFromPurchase,
    ).toHaveBeenCalled();
    expect(tx.financeSubscriptionPurchase.update).toHaveBeenCalled();
  });

  it('marks donation success during fulfillment', async () => {
    const tx = {
      financeDonation: {
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
    } as unknown as Prisma.TransactionClient;

    const payment: FinancePayment = {
      id: 'payment-don',
      userId: 'user-1',
      orderId: null,
      referenceType: 'donation',
      referenceId: 'donation-1',
      purpose: 'DONATION',
      meta: null,
    } as FinancePayment;

    await (service as any).fulfillPayment(tx, payment);

    expect(tx.financeDonation.updateMany).toHaveBeenCalled();
  });

  it('skips duplicate platform wallet debits when already processed', async () => {
    const orderItem: FinanceOrderItem = {
      id: 'item-4',
      orderId: 'order-dup',
      productId: 789n,
      unitPriceSnapshot: 1200,
      quantity: 1,
      lineTotal: 1200,
      productTypeSnapshot: 'PAID',
    } as FinanceOrderItem;

    const orderState: FinanceOrder = {
      id: 'order-dup',
      userId: 'user-1',
      status: OrderStatus.PENDING_PAYMENT,
      orderKind: OrderKind.PRODUCT,
      total: 1100,
      discountAmount: 100,
      discountSource: 'COUPON',
      couponCode: 'WELCOME10',
    } as unknown as FinanceOrder;

    const tx = {
      financeOrder: {
        findUnique: jest.fn(async () => orderState),
        update: jest.fn(async ({ data }) => {
          Object.assign(orderState, data);
          return orderState;
        }),
      },
      financeOrderItem: {
        findMany: jest.fn(async () => [orderItem]),
      },
      financeCart: {
        findFirst: jest.fn(async () => ({ id: 'cart-4', userId: 'user-1' })),
      },
      financeCartItem: {
        count: jest.fn(async () => 1),
      },
      user: {
        findUnique: jest.fn(async () => ({
          id: 'user-1',
          name: 'Buyer Name',
          firstName: 'Buyer',
          lastName: 'One',
          username: 'buyer',
          email: 'buyer@example.com',
          phone: '+989000000000',
        })),
      },
      product: {
        findMany: jest.fn(async () => [
          { id: 789n, title: 'Test Product', slug: 'test-product' },
        ]),
      },
    } as unknown as Prisma.TransactionClient;

    const payment: FinancePayment = {
      id: 'payment-4',
      userId: 'user-1',
      orderId: 'order-dup',
      meta: null,
    } as FinancePayment;

    const walletDebitSpy = jest
      .spyOn(service as any, 'applyWalletDebit')
      .mockResolvedValue({
        walletId: 'platform-wallet',
        newBalance: 400000,
        transactionId: 'wallet-tx-platform',
        alreadyProcessed: true,
      });

    await (service as any).fulfillOrderPayment(tx, payment);

    expect(walletDebitSpy).toHaveBeenCalledTimes(1);
    const notificationSpy = notificationsService
      .createNotification as jest.MockedFunction<
      NotificationsService['createNotification']
    >;
    expect(notificationSpy).not.toHaveBeenCalled();

    walletDebitSpy.mockRestore();
  });

  it('does not grant entitlements or clear cart on verification failure', async () => {
    const payment: FinancePayment = {
      id: 'payment-3',
      userId: 'user-1',
      orderId: 'order-fail',
      trackId: 'track-3',
      provider: PaymentProvider.ZIBAL,
      status: PaymentStatus.PENDING,
    } as FinancePayment;

    const failedPayment: FinancePayment = {
      ...payment,
      status: PaymentStatus.FAILED,
    } as FinancePayment;

    const tx = {
      financePayment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(failedPayment),
      },
      financeOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as Prisma.TransactionClient;

    const prisma: Partial<PrismaService> = {
      financePayment: {
        findFirst: jest.fn().mockResolvedValue(payment),
        findUnique: jest.fn().mockResolvedValue(failedPayment),
      },
      $transaction: jest.fn(async (cb) => cb(tx as Prisma.TransactionClient)),
    };

    service['prisma'] = prisma as PrismaService;
    service['gateway'] = {
      verifyPayment: jest.fn().mockResolvedValue({
        ok: false,
        amount: null,
        raw: null,
        refId: null,
      }),
    } as PaymentGateway;

    service['notifyOrderEvents'] = jest.fn();
    service['notifyWalletCreditFromPayment'] = jest.fn();

    await service.handleZibalCallback('track-3', undefined);

    expect(entitlementsService.grantPurchaseEntitlements).not.toHaveBeenCalled();
    expect(cartService.clearCartInTransaction).not.toHaveBeenCalled();
    expect(tx.financePayment.updateMany).toHaveBeenCalled();
  });
});
