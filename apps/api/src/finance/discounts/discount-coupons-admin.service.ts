import { BadRequestException, Injectable } from '@nestjs/common';
import { clampPagination, toPaginationResult } from '@app/catalog/utils/pagination.util';
import { PrismaService } from '@app/prisma/prisma.service';
import { CouponValueType } from '@app/finance/common/finance.enums';
import type { DiscountCoupon, Prisma } from '@prisma/client';

@Injectable()
export class DiscountCouponsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async createCoupon(input: {
    title: string;
    code: string;
    valueType: CouponValueType;
    value: number;
    maxUsage?: number;
    note?: string;
    expiresAt?: string | null;
    isActive?: boolean;
  }): Promise<DiscountCoupon> {
    const normalizedCode = this.normalizeCode(input.code);
    if (!normalizedCode) {
      throw new BadRequestException('Coupon code is required.');
    }

    this.assertValidValue(input.valueType, input.value);

    return this.prisma.discountCoupon.create({
      data: {
        title: input.title.trim(),
        code: normalizedCode,
        valueType: input.valueType,
        value: input.value,
        maxUsage: input.maxUsage ?? null,
        note: input.note?.trim() ?? null,
        expiresAt: this.parseDate(input.expiresAt),
        isActive: input.isActive ?? true,
      },
    });
  }

  async listCoupons(params: {
    page?: number;
    limit?: number;
    q?: string;
    isActive?: boolean;
    includeDeleted?: boolean;
  }) {
    const { page, limit, skip } = clampPagination(params.page, params.limit);
    const where: Prisma.DiscountCouponWhereInput = {};
    if (!params.includeDeleted) {
      where.deletedAt = null;
    }
    if (typeof params.isActive === 'boolean') {
      where.isActive = params.isActive;
    }
    if (params.q) {
      where.OR = [
        { code: { contains: params.q, mode: 'insensitive' } },
        { title: { contains: params.q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.discountCoupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.discountCoupon.count({ where }),
    ]);

    return toPaginationResult(data, total, page, limit);
  }

  async getCoupon(id: string): Promise<DiscountCoupon> {
    const coupon = await this.prisma.discountCoupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new BadRequestException('Discount coupon not found.');
    }
    return coupon;
  }

  async updateCoupon(
    id: string,
    input: {
      title?: string;
      code?: string;
      valueType?: CouponValueType;
      value?: number;
      maxUsage?: number | null;
      note?: string | null;
      expiresAt?: string | null;
      isActive?: boolean;
    },
  ): Promise<DiscountCoupon> {
    const existing = await this.prisma.discountCoupon.findUnique({ where: { id } });
    if (!existing) {
      throw new BadRequestException('Discount coupon not found.');
    }

    const targetValueType = input.valueType ?? existing.valueType;
    const targetValue = input.value ?? existing.value;
    if (input.valueType || input.value !== undefined) {
      this.assertValidValue(targetValueType, targetValue);
    }

    const data: Prisma.DiscountCouponUpdateInput = {};
    if (input.title) {
      data.title = input.title.trim();
    }
    if (input.code) {
      const normalized = this.normalizeCode(input.code);
      if (!normalized) {
        throw new BadRequestException('Coupon code is required.');
      }
      data.code = normalized;
    }
    if (input.valueType) {
      data.valueType = input.valueType;
    }
    if (input.value !== undefined) {
      data.value = input.value;
    }
    if (input.maxUsage !== undefined) {
      data.maxUsage = input.maxUsage;
    }
    if (input.note !== undefined) {
      data.note = input.note?.trim() ?? null;
    }
    if (input.expiresAt !== undefined) {
      data.expiresAt = this.parseDate(input.expiresAt);
    }
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }

    return this.prisma.discountCoupon.update({
      where: { id },
      data,
    });
  }

  async removeCoupon(id: string): Promise<DiscountCoupon> {
    return this.prisma.discountCoupon.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  private parseDate(value?: string | null): Date | null {
    if (value === null || value === undefined) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date value.');
    }
    return parsed;
  }

  private normalizeCode(value: string): string {
    return value.trim().toUpperCase();
  }

  private assertValidValue(type: CouponValueType, value: number): void {
    if (type === CouponValueType.PERCENT && (value < 1 || value > 100)) {
      throw new BadRequestException('Percent value must be between 1 and 100.');
    }
    if (type === CouponValueType.AMOUNT && value < 1) {
      throw new BadRequestException('Amount value must be at least 1.');
    }
  }
}
