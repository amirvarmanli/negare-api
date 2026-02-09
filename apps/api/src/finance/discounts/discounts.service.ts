import { BadRequestException, Injectable } from '@nestjs/common';
import { CouponValueType, DiscountType, OrderKind } from '@app/finance/common/finance.enums';
import { PrismaService } from '@app/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import type { DiscountCoupon } from '@prisma/client';

export interface DiscountLineItem {
  productId: string;
  pricingType: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export type DiscountQuoteSource = 'COUPON' | 'SUBSCRIPTION' | 'NONE';

export interface CouponDiscountMetadata {
  couponId?: string;
  code?: string;
  valueType?: CouponValueType;
  value?: number;
  discountAmount: number;
  reason: string;
}

export interface DiscountQuote {
  discountType: DiscountType;
  discountValue: number;
  subtotal: number;
  appliedDiscountSource: DiscountQuoteSource;
  appliedDiscountAmount: number;
  appliedDiscountPercent: number;
  appliedDiscountCode?: string;
  appliedDiscountReason: string;
  couponId?: string;
  discountMetadata: CouponDiscountMetadata;
  subscriptionDiscountPercent?: number;
  subscriptionDiscountRemaining?: number;
  subscriptionDiscountTotal?: number;
  subscriptionDiscountUsed?: number;
  subscriptionDiscountQuotaType?: 'LIFETIME';
  nonAppliedDiscounts: Array<{ source: 'COUPON' | 'SUBSCRIPTION'; code?: string; reason: string }>;
}

export interface SubscriptionDiscountCandidate {
  percent: number;
  remaining: number;
  total: number;
  used: number;
}

export interface DiscountQuoteParams {
  userId: string;
  items: DiscountLineItem[];
  couponCode?: string;
  orderKind: OrderKind;
  subscriptionDiscount?: SubscriptionDiscountCandidate | null;
}

@Injectable()
export class DiscountsService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateDiscountQuote(
    tx: Prisma.TransactionClient,
    params: DiscountQuoteParams,
  ): Promise<DiscountQuote> {
    void params.orderKind;
    const subtotal = params.items.reduce((sum, item) => sum + item.lineTotal, 0);
    if (subtotal <= 0) {
      return this.buildEmptyQuote(subtotal, params.subscriptionDiscount ?? null);
    }

    if (!params.couponCode) {
      if (this.hasSubscriptionDiscount(params.subscriptionDiscount)) {
        return this.buildSubscriptionQuote(
          subtotal,
          params.subscriptionDiscount!,
          this.buildEmptyQuote(subtotal, params.subscriptionDiscount ?? null),
        );
      }
      return this.buildEmptyQuote(subtotal, params.subscriptionDiscount ?? null);
    }

    const coupon = await this.resolveCoupon(tx, params.couponCode);
    const discountAmount = this.applyDiscount(subtotal, coupon);
    const appliedPercent = coupon.valueType === CouponValueType.PERCENT ? coupon.value : 0;
    const reason = this.buildReason(coupon, discountAmount, appliedPercent);
    const metadata = this.buildMetadata(coupon, discountAmount, reason);

    if (discountAmount <= 0) {
      const base = this.buildEmptyQuote(subtotal, params.subscriptionDiscount ?? null);
      base.appliedDiscountReason = reason;
      base.discountMetadata = metadata;
      base.couponId = coupon.id;
      base.nonAppliedDiscounts = [
        ...base.nonAppliedDiscounts,
        { source: 'COUPON', code: coupon.code, reason },
      ];

      if (this.hasSubscriptionDiscount(params.subscriptionDiscount)) {
        return this.buildSubscriptionQuote(
          subtotal,
          params.subscriptionDiscount!,
          base,
        );
      }

      return base;
    }

    const nonAppliedDiscounts = this.hasSubscriptionDiscount(params.subscriptionDiscount)
      ? [
          {
            source: 'SUBSCRIPTION' as const,
            reason: 'Subscription discount available but coupon applied.',
          },
        ]
      : [];

    return {
      discountType: DiscountType.COUPON,
      discountValue: discountAmount,
      subtotal,
      appliedDiscountSource: 'COUPON',
      appliedDiscountAmount: discountAmount,
      appliedDiscountPercent: appliedPercent,
      appliedDiscountCode: coupon.code,
      appliedDiscountReason: reason,
      couponId: coupon.id,
      discountMetadata: metadata,
      subscriptionDiscountPercent: params.subscriptionDiscount?.percent ?? 0,
      subscriptionDiscountRemaining: params.subscriptionDiscount?.remaining ?? 0,
      subscriptionDiscountTotal: params.subscriptionDiscount?.total ?? 0,
      subscriptionDiscountUsed: params.subscriptionDiscount?.used ?? 0,
      subscriptionDiscountQuotaType: 'LIFETIME',
      nonAppliedDiscounts,
    };
  }

  async commitCouponRedemption(
    tx: Prisma.TransactionClient,
    params: { couponId: string; userId: string; orderId: string },
  ): Promise<void> {
    await tx.$executeRaw`
      SELECT 1 FROM "finance"."discount_coupons"
      WHERE "id" = ${params.couponId}::uuid
      FOR UPDATE
    `;

    const coupon = await tx.discountCoupon.findUnique({ where: { id: params.couponId } });
    if (!coupon) {
      throw new BadRequestException({
        code: 'DISCOUNT_COUPON_INVALID',
        message: 'Coupon is no longer available.',
        meta: { couponId: params.couponId },
      });
    }

    this.ensureCouponUsable(coupon);

    await tx.discountCoupon.update({
      where: { id: coupon.id },
      data: { usedCount: { increment: 1 } },
    });

    await tx.discountCouponRedemption.create({
      data: {
        couponId: coupon.id,
        userId: params.userId,
        orderId: params.orderId,
      },
    });
  }

  private buildEmptyQuote(
    subtotal: number,
    subscription: SubscriptionDiscountCandidate | null,
  ): DiscountQuote {
    const metadata: CouponDiscountMetadata = {
      discountAmount: 0,
      reason: 'No coupon applied.',
    };

    return {
      discountType: DiscountType.NONE,
      discountValue: 0,
      subtotal,
      appliedDiscountSource: 'NONE',
      appliedDiscountAmount: 0,
      appliedDiscountPercent: 0,
      appliedDiscountReason: 'No coupon applied.',
      discountMetadata: metadata,
      subscriptionDiscountPercent: subscription?.percent ?? 0,
      subscriptionDiscountRemaining: subscription?.remaining ?? 0,
      subscriptionDiscountTotal: subscription?.total ?? 0,
      subscriptionDiscountUsed: subscription?.used ?? 0,
      subscriptionDiscountQuotaType: 'LIFETIME',
      nonAppliedDiscounts: [],
    };
  }

  private hasSubscriptionDiscount(
    subscription?: SubscriptionDiscountCandidate | null,
  ): boolean {
    return Boolean(
      subscription &&
        subscription.percent > 0 &&
        subscription.remaining > 0 &&
        subscription.total > 0,
    );
  }

  private buildSubscriptionQuote(
    subtotal: number,
    subscription: SubscriptionDiscountCandidate,
    base: DiscountQuote,
  ): DiscountQuote {
    const discountAmount = this.applyPercentDiscount(subtotal, subscription.percent);
    if (discountAmount <= 0) {
      return base;
    }
    return {
      ...base,
      discountType: DiscountType.PERCENT,
      discountValue: discountAmount,
      appliedDiscountSource: 'SUBSCRIPTION',
      appliedDiscountAmount: discountAmount,
      appliedDiscountPercent: subscription.percent,
      appliedDiscountReason: `Subscription discount applied: ${subscription.percent}% off`,
      nonAppliedDiscounts: base.nonAppliedDiscounts ?? [],
    };
  }

  private async resolveCoupon(
    tx: Prisma.TransactionClient,
    rawCode: string,
  ): Promise<DiscountCoupon> {
    const normalized = this.normalizeCouponCode(rawCode);
    if (!normalized) {
      throw new BadRequestException({
        code: 'DISCOUNT_COUPON_INVALID',
        message: 'Invalid coupon code.',
        meta: { code: rawCode },
      });
    }

    const coupon = await tx.discountCoupon.findFirst({
      where: { code: normalized },
    });

    if (!coupon) {
      throw new BadRequestException({
        code: 'DISCOUNT_COUPON_INVALID',
        message: 'Invalid coupon code.',
        meta: { code: normalized },
      });
    }

    this.ensureCouponUsable(coupon);

    return coupon;
  }

  private ensureCouponUsable(
    coupon: DiscountCoupon,
    code = coupon.code,
  ): void {
    const now = new Date();

    if (coupon.deletedAt) {
      throw new BadRequestException({
        code: 'DISCOUNT_COUPON_INVALID',
        message: 'Coupon is no longer available.',
        meta: { code, couponId: coupon.id },
      });
    }

    if (!coupon.isActive) {
      throw new BadRequestException({
        code: 'DISCOUNT_COUPON_INACTIVE',
        message: 'Coupon is inactive.',
        meta: { code },
      });
    }

    if (coupon.expiresAt && coupon.expiresAt <= now) {
      throw new BadRequestException({
        code: 'DISCOUNT_COUPON_EXPIRED',
        message: 'Coupon has expired.',
        meta: { code: coupon.code, expiresAt: coupon.expiresAt.toISOString() },
      });
    }

    if (coupon.maxUsage !== null && coupon.usedCount >= coupon.maxUsage) {
      throw new BadRequestException({
        code: 'DISCOUNT_COUPON_LIMIT_REACHED',
        message: 'Coupon usage limit reached.',
        meta: {
          code: coupon.code,
          maxUsage: coupon.maxUsage,
          usedCount: coupon.usedCount,
        },
      });
    }
  }

  private applyDiscount(subtotal: number, coupon: DiscountCoupon): number {
    if (coupon.valueType === CouponValueType.AMOUNT) {
      return Math.min(coupon.value, subtotal);
    }
    return Math.min(Math.floor((subtotal * coupon.value) / 100), subtotal);
  }

  private applyPercentDiscount(subtotal: number, percent: number): number {
    if (percent <= 0) {
      return 0;
    }
    return Math.min(Math.floor((subtotal * percent) / 100), subtotal);
  }

  private buildReason(
    coupon: DiscountCoupon,
    discountAmount: number,
    percentValue: number,
  ): string {
    if (discountAmount <= 0) {
      return 'No coupon applied.';
    }
    if (coupon.valueType === CouponValueType.PERCENT) {
      return `Coupon ${coupon.code} applied: ${percentValue}% off`;
    }
    return `Coupon ${coupon.code} applied: ${discountAmount} off`;
  }

  private buildMetadata(
    coupon: DiscountCoupon,
    discountAmount: number,
    reason: string,
  ): CouponDiscountMetadata {
    return {
      couponId: coupon.id,
      code: coupon.code,
      valueType: coupon.valueType,
      value: coupon.value,
      discountAmount,
      reason,
    };
  }

  private normalizeCouponCode(code: string): string {
    return code.trim().toUpperCase();
  }
}
