import { BadRequestException } from '@nestjs/common';
import { DiscountsService } from './discounts.service';
import { CouponValueType, OrderKind } from '@app/finance/common/finance.enums';
import { PrismaService } from '@app/prisma/prisma.service';
import type { Prisma } from '@prisma/client';

describe('DiscountsService', () => {
  let service: DiscountsService;
  let tx: Partial<Prisma.TransactionClient>;
  let prisma: Partial<PrismaService>;

  beforeEach(() => {
    tx = {
      discountCoupon: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      },
      discountCouponRedemption: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      $executeRaw: jest.fn().mockResolvedValue(undefined),
    } as unknown as Partial<Prisma.TransactionClient>;

    prisma = {
      discountCoupon: tx.discountCoupon,
      discountCouponRedemption: tx.discountCouponRedemption,
    } as Partial<PrismaService>;

    service = new DiscountsService(prisma as PrismaService);
  });

  const buildLineItems = (subtotal: number) => [
    {
      productId: '1',
      pricingType: 'PAID',
      unitPrice: subtotal,
      quantity: 1,
      lineTotal: subtotal,
    },
  ];

  const couponBase = (): Record<string, unknown> => ({
    id: 'coupon-1',
    code: 'WELCOME',
    title: 'Welcome',
    note: null,
    isActive: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it('applies a percent coupon', async () => {
    const coupon = {
      ...couponBase(),
      valueType: CouponValueType.PERCENT,
      value: 20,
      maxUsage: null,
      usedCount: 0,
      expiresAt: null,
    } as Prisma.DiscountCoupon;
    (tx.discountCoupon!.findFirst as jest.Mock).mockResolvedValue(coupon);

    const quote = await service.calculateDiscountQuote(
      tx as Prisma.TransactionClient,
      {
        userId: 'user-1',
        orderKind: OrderKind.PRODUCT,
        items: buildLineItems(100000),
        couponCode: 'welcome',
      },
    );

    expect(quote.discountValue).toBe(20000);
    expect(quote.appliedDiscountPercent).toBe(20);
    expect(quote.discountMetadata.valueType).toBe(CouponValueType.PERCENT);
    expect(quote.appliedDiscountSource).toBe('COUPON');
  });

  it('applies an amount coupon capped at subtotal', async () => {
    const coupon = {
      ...couponBase(),
      valueType: CouponValueType.AMOUNT,
      value: 500000,
      maxUsage: null,
      usedCount: 0,
      expiresAt: null,
    } as Prisma.DiscountCoupon;
    (tx.discountCoupon!.findFirst as jest.Mock).mockResolvedValue(coupon);

    const quote = await service.calculateDiscountQuote(
      tx as Prisma.TransactionClient,
      {
        userId: 'user-1',
        orderKind: OrderKind.PRODUCT,
        items: buildLineItems(200000),
        couponCode: 'welcome',
      },
    );

    expect(quote.discountValue).toBe(200000);
    expect(quote.appliedDiscountPercent).toBe(0);
    expect(quote.discountMetadata.value).toBe(500000);
  });

  it('rejects expired coupons', async () => {
    const coupon = {
      ...couponBase(),
      valueType: CouponValueType.PERCENT,
      value: 10,
      maxUsage: null,
      usedCount: 0,
      expiresAt: new Date(Date.now() - 1000),
    } as Prisma.DiscountCoupon;
    (tx.discountCoupon!.findFirst as jest.Mock).mockResolvedValue(coupon);

    await expect(
      service.calculateDiscountQuote(tx as Prisma.TransactionClient, {
        userId: 'user-1',
        orderKind: OrderKind.PRODUCT,
        items: buildLineItems(50000),
        couponCode: 'WELCOME',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'DISCOUNT_COUPON_EXPIRED' }),
    });
  });

  it('rejects coupons when usage limit reached', async () => {
    const coupon = {
      ...couponBase(),
      valueType: CouponValueType.AMOUNT,
      value: 10000,
      maxUsage: 1,
      usedCount: 1,
      expiresAt: null,
    } as Prisma.DiscountCoupon;
    (tx.discountCoupon!.findFirst as jest.Mock).mockResolvedValue(coupon);

    await expect(
      service.calculateDiscountQuote(tx as Prisma.TransactionClient, {
        userId: 'user-1',
        orderKind: OrderKind.PRODUCT,
        items: buildLineItems(50000),
        couponCode: 'WELCOME',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'DISCOUNT_COUPON_LIMIT_REACHED' }),
    });
  });
});
