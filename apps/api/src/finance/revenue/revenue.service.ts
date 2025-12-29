import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { ProductsService } from '@app/finance/products/products.service';
import {
  EntitlementSource,
  OrderKind,
  OrderStatus,
  RevenueBeneficiaryType,
  RevenuePoolStatus,
  EarningStatus,
} from '@app/finance/common/finance.enums';
import { buildMonthDateKeyRange } from '@app/finance/common/date.utils';
import { toBigIntString } from '@app/finance/common/prisma.utils';
import type {
  FinanceEntitlementSource,
  FinanceOrder,
  FinanceOrderItem,
  FinanceOrderKind,
  FinanceOrderStatus,
  FinanceRevenueBeneficiaryType,
  FinanceRevenuePoolStatus,
  FinanceEarningStatus,
  FinanceSubscriptionRevenuePool,
  FinanceSubscriptionSupplierEarning,
  Prisma,
} from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';

@Injectable()
export class RevenueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  async recordOrderRevenueSplits(
    order: FinanceOrder,
    items: FinanceOrderItem[],
  ): Promise<void> {
    if ((order.orderKind as OrderKind) !== OrderKind.PRODUCT) {
      return;
    }

    const splits: Prisma.FinanceOrderRevenueSplitCreateManyInput[] = [];

    for (const item of items) {
      const { supplierIds, supplierCount } =
        await this.productsService.resolveContributors(
          toBigIntString(item.productId),
        );

      const platformShare = Math.floor((item.lineTotal * 30) / 100);
      const supplierShareTotal = item.lineTotal - platformShare;

      splits.push({
        orderId: order.id,
        productId: item.productId,
        beneficiaryType: RevenueBeneficiaryType.PLATFORM as FinanceRevenueBeneficiaryType,
        supplierId: null,
        amount: platformShare,
      });

      if (supplierCount === 1 && supplierIds[0]) {
        splits.push({
          orderId: order.id,
          productId: item.productId,
          beneficiaryType: RevenueBeneficiaryType.SUPPLIER as FinanceRevenueBeneficiaryType,
          supplierId: supplierIds[0],
          amount: supplierShareTotal,
        });
      } else if (supplierCount === 2) {
        const first = Math.floor(supplierShareTotal / 2);
        const second = supplierShareTotal - first;
        splits.push(
          {
            orderId: order.id,
            productId: item.productId,
            beneficiaryType: RevenueBeneficiaryType.SUPPLIER as FinanceRevenueBeneficiaryType,
            supplierId: supplierIds[0] ?? null,
            amount: first,
          },
          {
            orderId: order.id,
            productId: item.productId,
            beneficiaryType: RevenueBeneficiaryType.SUPPLIER as FinanceRevenueBeneficiaryType,
            supplierId: supplierIds[1] ?? null,
            amount: second,
          },
        );
      }

    }

    if (splits.length > 0) {
      await this.prisma.financeOrderRevenueSplit.createMany({
        data: splits,
        skipDuplicates: true,
      });
    }
  }

  async computeSubscriptionPool(
    year: number,
    month: number,
  ): Promise<{
    pool: FinanceSubscriptionRevenuePool;
    earnings: FinanceSubscriptionSupplierEarning[];
  }> {
    const { startKey, endKey } = buildMonthDateKeyRange(year, month);

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    const orders = await this.prisma.financeOrder.findMany({
      where: {
        orderKind: OrderKind.SUBSCRIPTION as FinanceOrderKind,
        status: OrderStatus.PAID as FinanceOrderStatus,
        paidAt: { gte: startDate, lt: endDate },
      },
    });

    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const platformShareAmount = Math.floor((totalRevenue * 30) / 100);
    const distributableAmount = totalRevenue - platformShareAmount;

    const logs = await this.prisma.financeDownloadLog.findMany({
      where: {
        source: EntitlementSource.SUB_QUOTA as FinanceEntitlementSource,
        dateKey: { gte: startKey, lte: endKey },
      },
    });

    const credits = new Map<string, number>();
    for (const log of logs) {
      const { supplierIds, supplierCount } =
        await this.productsService.resolveContributors(
          toBigIntString(log.productId),
        );
      if (supplierCount === 1 && supplierIds[0]) {
        credits.set(
          supplierIds[0],
          (credits.get(supplierIds[0]) ?? 0) + 1,
        );
      } else if (supplierCount === 2) {
        const first = supplierIds[0];
        const second = supplierIds[1];
        if (first) {
          credits.set(first, (credits.get(first) ?? 0) + 0.5);
        }
        if (second) {
          credits.set(second, (credits.get(second) ?? 0) + 0.5);
        }
      }
    }

    const totalCredits = Array.from(credits.values()).reduce(
      (sum, value) => sum + value,
      0,
    );

    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0));

    const existingPool = await this.prisma.financeSubscriptionRevenuePool.findUnique({
      where: {
        periodStart_periodEnd: {
          periodStart,
          periodEnd,
        },
      },
    });

    if (
      existingPool &&
      (existingPool.status as RevenuePoolStatus) === RevenuePoolStatus.FINALIZED
    ) {
      throw new BadRequestException('Subscription revenue pool is finalized.');
    }

    const pool = await this.prisma.financeSubscriptionRevenuePool.upsert({
      where: {
        periodStart_periodEnd: {
          periodStart,
          periodEnd,
        },
      },
      update: {
        totalRevenue,
        platformShareAmount,
        distributableAmount,
        status: RevenuePoolStatus.OPEN as FinanceRevenuePoolStatus,
      },
      create: {
        periodStart,
        periodEnd,
        totalRevenue,
        platformShareAmount,
        distributableAmount,
        status: RevenuePoolStatus.OPEN as FinanceRevenuePoolStatus,
      },
    });

    await this.prisma.financeSubscriptionSupplierEarning.deleteMany({
      where: { poolId: pool.id },
    });

    const earnings: Prisma.FinanceSubscriptionSupplierEarningCreateManyInput[] = [];
    if (totalCredits > 0) {
      let allocated = 0;
      const supplierEntries = Array.from(credits.entries());
      for (let i = 0; i < supplierEntries.length; i += 1) {
        const [supplierId, credit] = supplierEntries[i];
        const isLast = i === supplierEntries.length - 1;
        const rawAmount = (distributableAmount * credit) / totalCredits;
        const amount = isLast
          ? distributableAmount - allocated
          : Math.floor(rawAmount);
        allocated += amount;
        earnings.push({
          poolId: pool.id,
          supplierId,
          downloadsCredit: new PrismaNamespace.Decimal(credit),
          amount,
          status: EarningStatus.PENDING as FinanceEarningStatus,
        });
      }
    }

    if (earnings.length > 0) {
      await this.prisma.financeSubscriptionSupplierEarning.createMany({
        data: earnings,
      });
    }

    const saved = await this.prisma.financeSubscriptionSupplierEarning.findMany({
      where: { poolId: pool.id },
    });

    return { pool, earnings: saved };
  }

  async finalizeSubscriptionPool(poolId: string): Promise<FinanceSubscriptionRevenuePool> {
    const pool = await this.prisma.financeSubscriptionRevenuePool.findUnique({
      where: { id: poolId },
    });
    if (!pool) {
      throw new BadRequestException('Subscription revenue pool not found.');
    }
    if ((pool.status as RevenuePoolStatus) === RevenuePoolStatus.FINALIZED) {
      return pool;
    }
    return this.prisma.financeSubscriptionRevenuePool.update({
      where: { id: poolId },
      data: { status: RevenuePoolStatus.FINALIZED as FinanceRevenuePoolStatus },
    });
  }

  async countPoolSuppliers(poolId: string): Promise<number> {
    return this.prisma.financeSubscriptionSupplierEarning.count({
      where: { poolId },
    });
  }

  async listSupplierEarnings(
    supplierId: string,
  ): Promise<FinanceSubscriptionSupplierEarning[]> {
    return this.prisma.financeSubscriptionSupplierEarning.findMany({
      where: { supplierId },
    });
  }
}
