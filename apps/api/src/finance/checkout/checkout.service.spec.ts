import { DiscountQuote } from '@app/finance/discounts/discounts.service';
import { CouponValueType, ProductPricingType } from '@app/finance/common/finance.enums';
import { PaymentsService } from '@app/finance/payments/payments.service';
import { CheckoutService } from './checkout.service';
import { ProductsService } from '@app/finance/products/products.service';
import { SubscriptionsService } from '@app/finance/subscriptions/subscriptions.service';
import { PrismaService } from '@app/prisma/prisma.service';
import type { Prisma } from '@prisma/client';

describe('CheckoutService', () => {
  let service: CheckoutService;
  let prisma: Partial<PrismaService>;
  let productsService: Partial<ProductsService>;
  let discountsService: Partial<{
    calculateDiscountQuote: jest.Mock<Promise<DiscountQuote>, unknown[]>;
    commitCouponRedemption: jest.Mock<Promise<void>, unknown[]>;
  }>;
  let paymentsService: Partial<PaymentsService>;
  let subscriptionsService: Partial<SubscriptionsService>;
  let txClient: Partial<Prisma.TransactionClient>;

  const productSnapshot = {
    id: '1024',
    pricingType: ProductPricingType.PAID,
    price: 100000,
  };

  const paymentResponse = {
    paymentId: 'payment-123',
    trackId: 'track-123',
    authority: 'track-123',
    gatewayUrl: 'https://gateway.example/123',
    amount: 180000,
  };

  beforeEach(() => {
    txClient = {
      financeOrder: { create: jest.fn() },
      financeOrderItem: { createMany: jest.fn().mockResolvedValue(undefined) },
    } as unknown as Prisma.TransactionClient;

    prisma = {
      $transaction: jest.fn(async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        cb(txClient as Prisma.TransactionClient),
      ),
      checkoutSession: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(undefined),
      },
      financeOrder: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    productsService = {
      findByIds: jest.fn().mockResolvedValue([productSnapshot]),
    };

    discountsService = {
      calculateDiscountQuote: jest.fn(),
      commitCouponRedemption: jest.fn().mockResolvedValue(undefined),
    };

    paymentsService = {
      initOrderPayment: jest.fn().mockResolvedValue(paymentResponse),
    };

    subscriptionsService = {
      getDiscountCandidate: jest.fn().mockResolvedValue(null),
      consumeSubscriptionDiscountForOrder: jest.fn().mockResolvedValue(null),
    };

    service = new CheckoutService(
      prisma as PrismaService,
      productsService as ProductsService,
      discountsService as any,
      paymentsService as PaymentsService,
      subscriptionsService as SubscriptionsService,
    );
  });

  it('creates a checkout order, commits coupon, and caches the session', async () => {
    const quote: DiscountQuote = {
      discountType: 'COUPON',
      discountValue: 20000,
      subtotal: 200000,
      appliedDiscountPercent: 10,
      appliedDiscountAmount: 20000,
      appliedDiscountSource: 'COUPON',
      appliedDiscountCode: 'WELCOME10',
      appliedDiscountReason: 'Coupon WELCOME10 applied: 10% off',
      couponId: 'coupon-1',
      discountMetadata: {
        couponId: 'coupon-1',
        code: 'WELCOME10',
        valueType: CouponValueType.PERCENT,
        value: 10,
        discountAmount: 20000,
        reason: 'Coupon WELCOME10 applied: 10% off',
      },
      subscriptionDiscountPercent: 0,
      subscriptionDiscountRemaining: 0,
      subscriptionDiscountTotal: 0,
      subscriptionDiscountUsed: 0,
      nonAppliedDiscounts: [],
    };

    (discountsService.calculateDiscountQuote as jest.Mock).mockResolvedValue(quote);

    const metadata = {
      subtotal: 200000,
      appliedDiscountSource: 'COUPON' as const,
      appliedDiscountPercent: 10,
      appliedDiscountAmount: 20000,
      appliedDiscountCode: 'WELCOME10',
      appliedDiscountReason: 'Coupon WELCOME10 applied: 10% off',
      couponId: 'coupon-1',
      couponCode: 'WELCOME10',
      couponValueType: CouponValueType.PERCENT,
      couponValue: 10,
      discountAmount: 20000,
      discountReason: 'Coupon WELCOME10 applied: 10% off',
      subscriptionDiscountPercent: 0,
      subscriptionDiscountTotal: 0,
      subscriptionDiscountUsed: 0,
      subscriptionDiscountRemaining: 0,
      nonAppliedDiscounts: [],
    };

    (txClient.financeOrder!.create as jest.Mock).mockResolvedValue({
      id: 'order-1',
      total: 180000,
      discountMetadata: metadata,
    });

    const response = await service.confirm('user-1', {
      items: [{ productId: '1024', quantity: 1 }],
      couponCode: 'WELCOME10',
      requestId: 'req-1',
    });

    expect(discountsService.commitCouponRedemption).toHaveBeenCalledTimes(1);
    expect(prisma.checkoutSession?.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requestId: 'req-1', orderId: 'order-1' }),
      }),
    );
    expect(response.orderId).toBe('order-1');
    expect(response.payment.paymentId).toBe('payment-123');
    expect(response.discountMetadata).toMatchObject(metadata);
  });

  it('returns cached session when it already exists', async () => {
    const cached = {
      orderId: 'order-1',
      total: 180000,
      appliedDiscountPercent: 10,
      appliedDiscountAmount: 20000,
      appliedDiscountSource: 'COUPON',
      appliedDiscountCode: 'WELCOME10',
      appliedDiscountReason: 'Cached',
      nonAppliedDiscounts: [],
      discountMetadata: {
        subtotal: 200000,
        appliedDiscountSource: 'COUPON',
        appliedDiscountPercent: 10,
        appliedDiscountAmount: 20000,
        appliedDiscountCode: 'WELCOME10',
        appliedDiscountReason: 'Cached',
        couponId: 'coupon-1',
        couponCode: 'WELCOME10',
        couponValueType: CouponValueType.PERCENT,
        couponValue: 10,
        discountAmount: 20000,
        discountReason: 'Cached',
        nonAppliedDiscounts: [],
      },
      payment: paymentResponse,
    };

    (prisma.checkoutSession?.findUnique as jest.Mock).mockResolvedValue({ response: cached });

    const result = await service.confirm('user-1', {
      items: [{ productId: '1024', quantity: 1 }],
      couponCode: 'WELCOME10',
      requestId: 'req-1',
    });

    expect(discountsService.commitCouponRedemption).not.toHaveBeenCalled();
    expect(result).toBe(cached);
    expect(productsService.findByIds).not.toHaveBeenCalled();
    expect(prisma.checkoutSession?.create).not.toHaveBeenCalled();
  });

});
