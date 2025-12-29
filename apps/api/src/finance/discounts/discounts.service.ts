import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import {
  DiscountType,
  DiscountValueType,
  OrderKind,
  ProductPricingType,
} from '@app/finance/common/finance.enums';
import { toBigInt } from '@app/finance/common/prisma.utils';
import type {
  FinanceCoupon,
  FinanceDiscountValueType,
  FinanceProductDiscount,
  FinanceUserDiscount,
  Prisma,
} from '@prisma/client';

export interface DiscountLineItem {
  productId: string;
  pricingType: ProductPricingType;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface DiscountResolution {
  discountType: DiscountType;
  discountValue: number;
  source: 'COUPON' | 'USER' | 'PRODUCT' | 'NONE';
  couponId?: string;
  couponCode?: string;
}

@Injectable()
export class DiscountsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveDiscount(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      orderKind: OrderKind;
      items: DiscountLineItem[];
      couponCode?: string;
    },
  ): Promise<DiscountResolution> {
    const payableItems = params.items.filter(
      (item) =>
        item.pricingType !== ProductPricingType.FREE && item.lineTotal > 0,
    );
    const payableSubtotal = payableItems.reduce(
      (sum, item) => sum + item.lineTotal,
      0,
    );

    if (payableSubtotal <= 0) {
      return {
        discountType: DiscountType.NONE,
        discountValue: 0,
        source: 'NONE',
      };
    }

    if (params.couponCode) {
      return this.resolveCouponDiscount(tx, params.couponCode, payableSubtotal, params.userId);
    }

    const userDiscount = await this.resolveUserDiscount(
      tx,
      params.userId,
      payableSubtotal,
    );
    if (userDiscount) {
      return userDiscount;
    }

    if (params.orderKind === OrderKind.SUBSCRIPTION) {
      return {
        discountType: DiscountType.NONE,
        discountValue: 0,
        source: 'NONE',
      };
    }

    const productDiscount = await this.resolveProductDiscount(
      tx,
      payableItems,
    );
    if (productDiscount) {
      return productDiscount;
    }

    return {
      discountType: DiscountType.NONE,
      discountValue: 0,
      source: 'NONE',
    };
  }

  private async resolveCouponDiscount(
    tx: Prisma.TransactionClient,
    rawCode: string,
    subtotal: number,
    userId: string,
  ): Promise<DiscountResolution> {
    const normalized = this.normalizeCouponCode(rawCode);
    const coupon = await tx.financeCoupon.findFirst({
      where: { code: normalized, isActive: true },
    });

    if (coupon) {
      this.assertCouponUsable(coupon);
      await this.assertCouponLimits(tx, coupon, userId);
      const discountValue = this.applyDiscount(
        subtotal,
        coupon.type as FinanceDiscountValueType,
        coupon.value,
      );
      return {
        discountType: DiscountType.COUPON,
        discountValue,
        source: 'COUPON',
        couponId: coupon.id,
        couponCode: coupon.code,
      };
    }

    const parsed = this.parsePatternCoupon(normalized, subtotal);
    if (parsed) {
      return {
        discountType: DiscountType.COUPON,
        discountValue: parsed,
        source: 'COUPON',
        couponCode: normalized,
      };
    }

    throw new BadRequestException('Invalid coupon code.');
  }

  private async resolveUserDiscount(
    tx: Prisma.TransactionClient,
    userId: string,
    subtotal: number,
  ): Promise<DiscountResolution | null> {
    const now = new Date();
    const discounts = await tx.financeUserDiscount.findMany({
      where: {
        userId,
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
    });

    const best = this.pickBestDiscount(discounts, subtotal);
    if (!best) {
      return null;
    }

    return {
      discountType: best.type as DiscountType,
      discountValue: best.amount,
      source: 'USER',
    };
  }

  private async resolveProductDiscount(
    tx: Prisma.TransactionClient,
    items: DiscountLineItem[],
  ): Promise<DiscountResolution | null> {
    if (items.length === 0) {
      return null;
    }
    const now = new Date();
    const productIds = items.map((item) => toBigInt(item.productId));
    const discounts = await tx.financeProductDiscount.findMany({
      where: {
        productId: { in: productIds },
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
    });

    if (discounts.length === 0) {
      return null;
    }

    let best: { amount: number; type: FinanceDiscountValueType } | null = null;
    for (const item of items) {
      const itemDiscounts = discounts.filter(
        (discount) => discount.productId === toBigInt(item.productId),
      );
      if (itemDiscounts.length === 0) {
        continue;
      }
      const bestForItem = this.pickBestDiscount(
        itemDiscounts,
        item.lineTotal,
        item.quantity,
      );
      if (!bestForItem) {
        continue;
      }
      if (!best || bestForItem.amount > best.amount) {
        best = bestForItem;
      }
    }

    if (!best || best.amount <= 0) {
      return null;
    }

    return {
      discountType: best.type as DiscountType,
      discountValue: best.amount,
      source: 'PRODUCT',
    };
  }

  private pickBestDiscount(
    discounts: FinanceUserDiscount[] | FinanceProductDiscount[],
    subtotal: number,
    quantity = 1,
  ): { amount: number; type: FinanceDiscountValueType } | null {
    let best: { amount: number; type: FinanceDiscountValueType } | null = null;
    for (const discount of discounts) {
      const value = this.applyDiscount(
        subtotal,
        discount.type as FinanceDiscountValueType,
        discount.value,
        quantity,
      );
      if (!best || value > best.amount) {
        best = { amount: value, type: discount.type as FinanceDiscountValueType };
      }
    }
    return best;
  }

  private applyDiscount(
    subtotal: number,
    type: FinanceDiscountValueType,
    value: number,
    quantity = 1,
  ): number {
    if (subtotal <= 0 || value <= 0) {
      return 0;
    }
    if (type === DiscountValueType.FIXED) {
      const fixedValue = value * Math.max(1, quantity);
      return Math.min(fixedValue, subtotal);
    }
    const percentValue = Math.floor((subtotal * value) / 100);
    return Math.min(percentValue, subtotal);
  }

  private parsePatternCoupon(code: string, subtotal: number): number | null {
    if (code.startsWith('FIXED_')) {
      const value = Number(code.replace('FIXED_', ''));
      if (!Number.isFinite(value) || value <= 0) {
        return null;
      }
      return Math.min(value, subtotal);
    }

    if (code.startsWith('PERCENT_')) {
      const value = Number(code.replace('PERCENT_', ''));
      if (!Number.isFinite(value) || value <= 0) {
        return null;
      }
      return Math.min(Math.floor((subtotal * value) / 100), subtotal);
    }

    return null;
  }

  private normalizeCouponCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private assertCouponUsable(coupon: FinanceCoupon): void {
    const now = new Date();
    if (coupon.expiresAt && coupon.expiresAt <= now) {
      throw new BadRequestException('Coupon has expired.');
    }
  }

  private async assertCouponLimits(
    tx: Prisma.TransactionClient,
    coupon: FinanceCoupon,
    userId: string,
  ): Promise<void> {
    const totalCount = await tx.financeCouponRedemption.count({
      where: { couponId: coupon.id },
    });
    if (coupon.maxUsage && totalCount >= coupon.maxUsage) {
      throw new BadRequestException('Coupon usage limit reached.');
    }

    const userCount = await tx.financeCouponRedemption.count({
      where: { couponId: coupon.id, userId },
    });
    if (coupon.maxUsagePerUser && userCount >= coupon.maxUsagePerUser) {
      throw new BadRequestException('Coupon usage limit reached for user.');
    }
  }
}
