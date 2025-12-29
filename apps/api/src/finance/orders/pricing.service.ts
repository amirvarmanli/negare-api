import { Injectable } from '@nestjs/common';
import { DiscountType } from '@app/finance/common/finance.enums';
import type { DiscountInputDto } from '@app/finance/orders/dto/create-order.dto';

export interface PricingResult {
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  total: number;
}

@Injectable()
export class PricingService {
  resolveDiscount(
    subtotal: number,
    discount: DiscountInputDto | undefined,
    couponCode: string | undefined,
  ): { discountType: DiscountType; discountValue: number } {
    const discounts: { type: DiscountType; value: number }[] = [];

    if (discount) {
      discounts.push({ type: discount.type, value: discount.value });
    }

    if (couponCode) {
      const coupon = this.parseCoupon(couponCode, subtotal);
      if (coupon) {
        discounts.push(coupon);
      }
    }

    if (discounts.length === 0) {
      return { discountType: DiscountType.NONE, discountValue: 0 };
    }

    const best = discounts.reduce((prev, current) =>
      current.value > prev.value ? current : prev,
    );

    return {
      discountType: best.type,
      discountValue: Math.min(best.value, subtotal),
    };
  }

  calculateTotals(
    subtotal: number,
    discount: DiscountInputDto | undefined,
    couponCode: string | undefined,
  ): PricingResult {
    const { discountType, discountValue } = this.resolveDiscount(
      subtotal,
      discount,
      couponCode,
    );
    const total = Math.max(0, subtotal - discountValue);

    return {
      subtotal,
      discountType,
      discountValue,
      total,
    };
  }

  private parseCoupon(
    couponCode: string,
    subtotal: number,
  ): { type: DiscountType; value: number } | null {
    const normalized = couponCode.trim().toUpperCase();
    if (normalized.startsWith('FIXED_')) {
      const value = Number(normalized.replace('FIXED_', ''));
      if (!Number.isFinite(value) || value <= 0) {
        return null;
      }
      return { type: DiscountType.COUPON, value: Math.min(value, subtotal) };
    }

    if (normalized.startsWith('PERCENT_')) {
      const value = Number(normalized.replace('PERCENT_', ''));
      if (!Number.isFinite(value) || value <= 0) {
        return null;
      }
      const discountValue = Math.floor((subtotal * value) / 100);
      return { type: DiscountType.COUPON, value: discountValue };
    }

    return null;
  }
}
