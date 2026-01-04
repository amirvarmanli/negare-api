import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { SubscriptionStatus } from '@app/finance/subscription-system/subscription-system.enums';
import type {
  FinanceSubscriptionStatus,
  Prisma,
  Subscription,
  SubscriptionPlan,
} from '@prisma/client';

@Injectable()
export class UserSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveSubscription(
    userId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Subscription | null> {
    const now = new Date();
    const subscription = await tx.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE as FinanceSubscriptionStatus },
      orderBy: { endAt: 'desc' },
    });

    if (!subscription) {
      return null;
    }

    if (subscription.endAt <= now) {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.EXPIRED as FinanceSubscriptionStatus },
      });
      return null;
    }

    return subscription;
  }

  async getPlanById(planId: string): Promise<SubscriptionPlan> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found.');
    }
    return plan;
  }

  async purchaseSubscription(userId: string, planId: string): Promise<Subscription> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.getActiveSubscription(userId, tx);
      if (existing) {
        throw new ConflictException('Active subscription already exists.');
      }

      const plan = await tx.subscriptionPlan.findFirst({
        where: { id: planId, isActive: true },
      });
      if (!plan) {
        throw new NotFoundException('Subscription plan not found.');
      }

      const startAt = new Date();
      const endAt = new Date(
        startAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000,
      );

      return tx.subscription.create({
        data: {
          userId,
          planId: plan.id,
          planTitle: plan.title,
          price: plan.price,
          durationDays: plan.durationDays,
          dailySubscriptionDownloadLimit: plan.dailySubscriptionDownloadLimit,
          dailyFreeDownloadLimitWithSubscription:
            plan.dailyFreeDownloadLimitWithSubscription,
          discountPercent: plan.discountPercent ?? null,
          discountRemaining: plan.discountQuota ?? 0,
          startAt,
          endAt,
          status: SubscriptionStatus.ACTIVE as FinanceSubscriptionStatus,
        },
      });
    });
  }

  async getDiscountCandidate(
    userId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<{ subscription: Subscription; discountPercent: number } | null> {
    const subscription = await this.getActiveSubscription(userId, tx);
    if (!subscription) {
      return null;
    }

    const discountPercent = subscription.discountPercent ?? 0;
    if (discountPercent <= 0 || subscription.discountRemaining <= 0) {
      return null;
    }

    return { subscription, discountPercent };
  }
}
