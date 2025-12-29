import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { clampPagination, toPaginationResult } from '@app/catalog/utils/pagination.util';
import { EarningStatus, PayoutStatus, RevenueBeneficiaryType } from '@app/finance/common/finance.enums';
import { toBigIntString } from '@app/finance/common/prisma.utils';
import type { Prisma } from '@prisma/client';

@Injectable()
export class SupplierReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(supplierId?: string) {
    const salesWhere: Prisma.FinanceOrderRevenueSplitWhereInput = {
      beneficiaryType: RevenueBeneficiaryType.SUPPLIER,
      supplierId,
    };
    const subWhere: Prisma.FinanceSubscriptionSupplierEarningWhereInput = {
      supplierId,
    };

    const [salesSum, paidSalesSum, subsSum, paidSubsSum] =
      await this.prisma.$transaction([
        this.prisma.financeOrderRevenueSplit.aggregate({
          where: salesWhere,
          _sum: { amount: true },
        }),
        this.prisma.financeOrderRevenueSplit.aggregate({
          where: {
            ...salesWhere,
            payout: { status: PayoutStatus.PAID },
          },
          _sum: { amount: true },
        }),
        this.prisma.financeSubscriptionSupplierEarning.aggregate({
          where: subWhere,
          _sum: { amount: true },
        }),
        this.prisma.financeSubscriptionSupplierEarning.aggregate({
          where: {
            ...subWhere,
            status: EarningStatus.PAID,
          },
          _sum: { amount: true },
        }),
      ]);

    const totalPaidSales = salesSum._sum.amount ?? 0;
    const totalSubscriptionEarnings = subsSum._sum.amount ?? 0;
    const finalizedAmount = (paidSalesSum._sum.amount ?? 0) + (paidSubsSum._sum.amount ?? 0);
    const pendingAmount = totalPaidSales + totalSubscriptionEarnings - finalizedAmount;

    return {
      totalPaidSales,
      totalSubscriptionEarnings,
      pendingAmount,
      finalizedAmount,
    };
  }

  async listOrders(params: {
    supplierId?: string;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, skip } = clampPagination(params.page, params.limit);
    const where: Prisma.FinanceOrderRevenueSplitWhereInput = {
      beneficiaryType: RevenueBeneficiaryType.SUPPLIER,
      supplierId: params.supplierId,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.financeOrderRevenueSplit.findMany({
        where,
        include: { order: true, payout: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.financeOrderRevenueSplit.count({ where }),
    ]);

    return toPaginationResult(data, total, page, limit);
  }

  async listSubscriptionEarnings(params: {
    supplierId?: string;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, skip } = clampPagination(params.page, params.limit);
    const where: Prisma.FinanceSubscriptionSupplierEarningWhereInput = {
      supplierId: params.supplierId,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.financeSubscriptionSupplierEarning.findMany({
        where,
        include: { pool: true, payout: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.financeSubscriptionSupplierEarning.count({ where }),
    ]);
    return toPaginationResult(data, total, page, limit);
  }

  async listDownloads(params: {
    supplierId?: string;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, skip } = clampPagination(params.page, params.limit);
    const productIds = params.supplierId
      ? await this.getSupplierProductIds(params.supplierId)
      : [];

    const where: Prisma.FinanceDownloadLogWhereInput =
      params.supplierId && productIds.length > 0
        ? { productId: { in: productIds } }
        : params.supplierId
          ? { productId: { in: [] } }
          : {};

    const [data, total] = await this.prisma.$transaction([
      this.prisma.financeDownloadLog.findMany({
        where,
        orderBy: { dateTime: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.financeDownloadLog.count({ where }),
    ]);

    return toPaginationResult(data, total, page, limit);
  }

  private async getSupplierProductIds(supplierId: string): Promise<bigint[]> {
    const [contributors, suppliers] = await this.prisma.$transaction([
      this.prisma.financeProductContributor.findMany({
        where: { supplierId },
        select: { productId: true },
      }),
      this.prisma.productSupplier.findMany({
        where: { userId: supplierId },
        select: { productId: true },
      }),
    ]);

    const ids = new Set<string>();
    for (const item of contributors) {
      ids.add(toBigIntString(item.productId));
    }
    for (const item of suppliers) {
      ids.add(toBigIntString(item.productId));
    }

    return Array.from(ids).map((id) => BigInt(id));
  }
}
