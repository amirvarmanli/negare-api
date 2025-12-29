import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { clampPagination, toPaginationResult } from '@app/catalog/utils/pagination.util';
import { DiscountValueType } from '@app/finance/common/finance.enums';
import { toBigInt } from '@app/finance/common/prisma.utils';
import type {
  FinanceCoupon,
  FinanceProductDiscount,
  FinanceUserDiscount,
  FinanceDiscountValueType,
} from '@prisma/client';

@Injectable()
export class DiscountsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async createProductDiscount(input: {
    productId: string;
    type: DiscountValueType;
    value: number;
    startsAt?: string;
    endsAt?: string;
    isActive?: boolean;
  }): Promise<FinanceProductDiscount> {
    const startsAt = this.parseDate(input.startsAt);
    const endsAt = this.parseDate(input.endsAt);
    this.assertValidDateRange(startsAt, endsAt);
    return this.prisma.financeProductDiscount.create({
      data: {
        productId: toBigInt(input.productId),
        type: input.type as FinanceDiscountValueType,
        value: input.value,
        startsAt,
        endsAt,
        isActive: input.isActive ?? true,
      },
    });
  }

  async listProductDiscounts(params: {
    page?: number;
    limit?: number;
  }) {
    const { page, limit, skip } = clampPagination(params.page, params.limit);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.financeProductDiscount.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.financeProductDiscount.count(),
    ]);
    return toPaginationResult(data, total, page, limit);
  }

  async createUserDiscount(input: {
    userId: string;
    type: DiscountValueType;
    value: number;
    startsAt?: string;
    endsAt?: string;
    isActive?: boolean;
  }): Promise<FinanceUserDiscount> {
    const startsAt = this.parseDate(input.startsAt);
    const endsAt = this.parseDate(input.endsAt);
    this.assertValidDateRange(startsAt, endsAt);
    return this.prisma.financeUserDiscount.create({
      data: {
        userId: input.userId,
        type: input.type as FinanceDiscountValueType,
        value: input.value,
        startsAt,
        endsAt,
        isActive: input.isActive ?? true,
      },
    });
  }

  async listUserDiscounts(params: { page?: number; limit?: number }) {
    const { page, limit, skip } = clampPagination(params.page, params.limit);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.financeUserDiscount.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.financeUserDiscount.count(),
    ]);
    return toPaginationResult(data, total, page, limit);
  }

  async createCoupon(input: {
    code: string;
    type: DiscountValueType;
    value: number;
    maxUsage?: number;
    maxUsagePerUser?: number;
    expiresAt?: string;
    isActive?: boolean;
  }): Promise<FinanceCoupon> {
    const code = input.code.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException('Coupon code is required.');
    }
    return this.prisma.financeCoupon.create({
      data: {
        code,
        type: input.type as FinanceDiscountValueType,
        value: input.value,
        maxUsage: input.maxUsage,
        maxUsagePerUser: input.maxUsagePerUser,
        expiresAt: this.parseDate(input.expiresAt),
        isActive: input.isActive ?? true,
      },
    });
  }

  async listCoupons(params: { page?: number; limit?: number }) {
    const { page, limit, skip } = clampPagination(params.page, params.limit);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.financeCoupon.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.financeCoupon.count(),
    ]);
    return toPaginationResult(data, total, page, limit);
  }

  private parseDate(value?: string): Date | null {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date value.');
    }
    return parsed;
  }

  private assertValidDateRange(startsAt: Date | null, endsAt: Date | null): void {
    if (startsAt && endsAt && startsAt > endsAt) {
      throw new BadRequestException('startsAt must be before endsAt.');
    }
  }
}
