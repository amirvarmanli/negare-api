import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import {
  EarningStatus,
  PayoutStatus,
  RevenueBeneficiaryType,
  RevenuePoolStatus,
} from '@app/finance/common/finance.enums';
import type { FinanceSupplierPayout, Prisma } from '@prisma/client';

interface PayoutAggregate {
  supplierId: string;
  orderSplitIds: string[];
  subscriptionEarningIds: string[];
  amount: number;
}

@Injectable()
export class PayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  async computePayouts(params: {
    periodStart?: string;
    periodEnd?: string;
  }): Promise<FinanceSupplierPayout[]> {
    const { periodStart, periodEnd } = this.parsePeriod(params);

    const [orderSplits, subscriptionEarnings] = await this.prisma.$transaction([
      this.prisma.financeOrderRevenueSplit.findMany({
        where: {
          beneficiaryType: RevenueBeneficiaryType.SUPPLIER,
          payoutId: null,
          ...(periodStart && periodEnd
            ? { order: { paidAt: { gte: periodStart, lte: periodEnd } } }
            : {}),
        },
      }),
      this.prisma.financeSubscriptionSupplierEarning.findMany({
        where: {
          payoutId: null,
          status: EarningStatus.PENDING,
          pool:
            periodStart && periodEnd
              ? {
                  status: RevenuePoolStatus.FINALIZED,
                  periodStart: { gte: periodStart },
                  periodEnd: { lte: periodEnd },
                }
              : { status: RevenuePoolStatus.FINALIZED },
        },
      }),
    ]);

    const aggregates = new Map<string, PayoutAggregate>();

    for (const split of orderSplits) {
      if (!split.supplierId) {
        continue;
      }
      const entry =
        aggregates.get(split.supplierId) ??
        ({
          supplierId: split.supplierId,
          orderSplitIds: [],
          subscriptionEarningIds: [],
          amount: 0,
        } satisfies PayoutAggregate);
      entry.orderSplitIds.push(split.id);
      entry.amount += split.amount;
      aggregates.set(split.supplierId, entry);
    }

    for (const earning of subscriptionEarnings) {
      const entry =
        aggregates.get(earning.supplierId) ??
        ({
          supplierId: earning.supplierId,
          orderSplitIds: [],
          subscriptionEarningIds: [],
          amount: 0,
        } satisfies PayoutAggregate);
      entry.subscriptionEarningIds.push(earning.id);
      entry.amount += earning.amount;
      aggregates.set(earning.supplierId, entry);
    }

    if (aggregates.size === 0) {
      return [];
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const payouts: FinanceSupplierPayout[] = [];

      for (const aggregate of aggregates.values()) {
        if (aggregate.amount <= 0) {
          continue;
        }
        const payout = await tx.financeSupplierPayout.create({
          data: {
            supplierId: aggregate.supplierId,
            amount: aggregate.amount,
            periodStart: periodStart ?? null,
            periodEnd: periodEnd ?? null,
            status: PayoutStatus.PENDING,
          },
        });

        if (aggregate.orderSplitIds.length > 0) {
          await tx.financeOrderRevenueSplit.updateMany({
            where: { id: { in: aggregate.orderSplitIds }, payoutId: null },
            data: { payoutId: payout.id },
          });
        }

        if (aggregate.subscriptionEarningIds.length > 0) {
          await tx.financeSubscriptionSupplierEarning.updateMany({
            where: {
              id: { in: aggregate.subscriptionEarningIds },
              payoutId: null,
            },
            data: { payoutId: payout.id },
          });
        }

        payouts.push(payout);
      }

      return payouts;
    });
  }

  async markPaid(
    payoutId: string,
    reference?: string,
  ): Promise<FinanceSupplierPayout> {
    const payout = await this.prisma.financeSupplierPayout.findUnique({
      where: { id: payoutId },
    });
    if (!payout) {
      throw new BadRequestException('Payout not found.');
    }
    if (payout.status !== PayoutStatus.PENDING) {
      throw new BadRequestException('Payout is not pending.');
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.financeSupplierPayout.update({
        where: { id: payoutId },
        data: { status: PayoutStatus.PAID, reference },
      });

      await tx.financeSubscriptionSupplierEarning.updateMany({
        where: { payoutId },
        data: { status: EarningStatus.PAID },
      });

      return updated;
    });
  }

  async markFailed(payoutId: string): Promise<FinanceSupplierPayout> {
    const payout = await this.prisma.financeSupplierPayout.findUnique({
      where: { id: payoutId },
    });
    if (!payout) {
      throw new BadRequestException('Payout not found.');
    }
    if (payout.status !== PayoutStatus.PENDING) {
      throw new BadRequestException('Payout is not pending.');
    }
    return this.prisma.financeSupplierPayout.update({
      where: { id: payoutId },
      data: { status: PayoutStatus.FAILED },
    });
  }

  private parsePeriod(params: {
    periodStart?: string;
    periodEnd?: string;
  }): { periodStart: Date | undefined; periodEnd: Date | undefined } {
    if (!params.periodStart && !params.periodEnd) {
      return { periodStart: undefined, periodEnd: undefined };
    }
    if (!params.periodStart || !params.periodEnd) {
      throw new BadRequestException('Both periodStart and periodEnd are required.');
    }
    const start = new Date(params.periodStart);
    const end = new Date(params.periodEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid periodStart or periodEnd.');
    }
    if (start > end) {
      throw new BadRequestException('periodStart must be before periodEnd.');
    }
    return { periodStart: start, periodEnd: end };
  }
}
