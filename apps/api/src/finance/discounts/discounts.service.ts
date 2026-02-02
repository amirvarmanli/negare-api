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

export type DiscountQuoteSource = 'COUPON' | 'NONE';

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
}

export interface DiscountQuoteParams {
  userId: string;
  items: DiscountLineItem[];
  couponCode?: string;
  orderKind: OrderKind;
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
      return this.buildEmptyQuote(subtotal);
    }

    if (!params.couponCode) {
      return this.buildEmptyQuote(subtotal);
    }

    const coupon = await this.resolveCoupon(tx, params.couponCode);
    const discountAmount = this.applyDiscount(subtotal, coupon);
    const appliedPercent = coupon.valueType === CouponValueType.PERCENT ? coupon.value : 0;
    const reason = this.buildReason(coupon, discountAmount, appliedPercent);
    const metadata = this.buildMetadata(coupon, discountAmount, reason);

    if (discountAmount <= 0) {
      return {
        discountType: DiscountType.NONE,
        discountValue: 0,
        subtotal,
        appliedDiscountSource: 'NONE',
        appliedDiscountAmount: 0,
        appliedDiscountPercent: 0,
        appliedDiscountReason: reason,
        discountMetadata: metadata,
      };
    }

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

  private buildEmptyQuote(subtotal: number): DiscountQuote {
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
