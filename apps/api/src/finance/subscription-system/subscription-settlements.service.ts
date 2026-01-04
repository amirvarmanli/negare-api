import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { SubscriptionStatus, SubscriptionDownloadType } from '@app/finance/subscription-system/subscription-system.enums';
import type {
  FinanceSubscriptionStatus,
  Prisma,
  Subscription,
  SubscriptionSettlement,
  SubscriptionSettlementSupplier,
} from '@prisma/client';

export interface SettlementResult {
  settlement: SubscriptionSettlement;
  suppliers: SubscriptionSettlementSupplier[];
}

@Injectable()
export class SubscriptionSettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async settleExpiredSubscriptions(limit = 50): Promise<SettlementResult[]> {
    const now = new Date();
    const expired = await this.prisma.subscription.findMany({
      where: {
        endAt: { lt: now },
        status: {
          in: [
            SubscriptionStatus.ACTIVE as FinanceSubscriptionStatus,
            SubscriptionStatus.EXPIRED as FinanceSubscriptionStatus,
          ],
        },
      },
      orderBy: { endAt: 'asc' },
      take: limit,
    });

    const results: SettlementResult[] = [];
    for (const subscription of expired) {
      const result = await this.settleSubscription(subscription);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  private async settleSubscription(
    subscription: Subscription,
  ): Promise<SettlementResult | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.subscriptionSettlement.findUnique({
        where: { subscriptionId: subscription.id },
      });
      if (existing) {
        return null;
      }

      const logs = await tx.subscriptionDownloadLog.findMany({
        where: {
          subscriptionId: subscription.id,
          downloadType: SubscriptionDownloadType.SUBSCRIPTION,
          createdAt: { gte: subscription.startAt, lte: subscription.endAt },
        },
      });

      const totalDownloads = logs.length;
      const supplierCredits = new Map<string, number>();
      for (const log of logs) {
        supplierCredits.set(
          log.supplierId,
          (supplierCredits.get(log.supplierId) ?? 0) + 1,
        );
      }

      const supplierAmount =
        totalDownloads === 0 ? 0 : Math.floor((subscription.price * 70) / 100);
      const platformAmount = subscription.price - supplierAmount;

      const settlement = await tx.subscriptionSettlement.create({
        data: {
          subscriptionId: subscription.id,
          userId: subscription.userId,
          planId: subscription.planId,
          price: subscription.price,
          totalDownloads,
          platformAmount,
          supplierAmount,
        },
      });

      const suppliers: Prisma.SubscriptionSettlementSupplierCreateManyInput[] = [];
      if (totalDownloads > 0 && supplierCredits.size > 0) {
        let allocated = 0;
        const entries = Array.from(supplierCredits.entries());
        for (let index = 0; index < entries.length; index += 1) {
          const [supplierId, count] = entries[index];
          const isLast = index === entries.length - 1;
          const rawAmount = (supplierAmount * count) / totalDownloads;
          const amount = isLast ? supplierAmount - allocated : Math.floor(rawAmount);
          allocated += amount;
          suppliers.push({
            settlementId: settlement.id,
            supplierId,
            downloadCount: count,
            amount,
          });
        }
      }

      if (suppliers.length > 0) {
        await tx.subscriptionSettlementSupplier.createMany({ data: suppliers });
      }

      if (subscription.status !== (SubscriptionStatus.EXPIRED as FinanceSubscriptionStatus)) {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { status: SubscriptionStatus.EXPIRED as FinanceSubscriptionStatus },
        });
      }

      const savedSuppliers = await tx.subscriptionSettlementSupplier.findMany({
        where: { settlementId: settlement.id },
      });

      return { settlement, suppliers: savedSuppliers };
    });
  }
}
