import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import {
  SubscriptionPlanCode,
  SubscriptionStatus,
} from '@app/finance/common/finance.enums';
import {
  BASE_FREE_DAILY_LIMIT,
  SUBSCRIPTION_DURATIONS_MONTHS,
  SUBSCRIPTION_PLAN_PRICING,
} from '@app/finance/common/finance.constants';
import { DiscountType, OrderKind, OrderStatus } from '@app/finance/common/finance.enums';
import {
  addMonths,
  getTehranDateKey,
  getTehranResetAt,
} from '@app/finance/common/date.utils';
import type { LegacyPurchaseSubscriptionDto } from '@app/finance/subscriptions/dto/purchase-subscription.dto';
import type { SubscriptionPurchaseDto } from '@app/finance/subscriptions/dto/subscription-purchase.dto';
import type { SubscriptionStatusDto } from '@app/finance/subscriptions/dto/subscription-status.dto';
import {
  FinanceDiscountType,
  FinanceOrder,
  FinanceOrderKind,
  FinanceOrderStatus,
  FinanceSubscriptionPurchase,
  FinanceSubscriptionPurchaseStatus,
  FinanceSubscriptionStatus,
  Prisma,
  Subscription,
  SubscriptionPlan,
} from '@prisma/client';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlans(): Promise<SubscriptionPlan[]> {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
    });
  }

  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatusDto> {
    const subscription = await this.getActiveSubscription(userId);
    if (!subscription) {
      return {
        hasActiveSubscription: false,
        remainingDailyDownloads: null,
        subscriptionPlan: null,
      };
    }

    const plan = await this.getPlanById(subscription.planId);
    const dateKey = getTehranDateKey();
    const usage = await this.prisma.subscriptionDailyQuotaUsage.findUnique({
      where: { userId_dateKey: { userId, dateKey } },
      select: { downloadsUsed: true, downloadsLimitSnapshot: true },
    });
    const limit = usage?.downloadsLimitSnapshot ?? plan.dailyDownloadLimit;
    const used = usage?.downloadsUsed ?? 0;

    return {
      hasActiveSubscription: true,
      remainingDailyDownloads: Math.max(0, limit - used),
      subscriptionPlan: {
        id: plan.id,
        title: plan.title,
        dailyDownloadLimit: plan.dailyDownloadLimit,
        price: plan.price,
        durationDays: plan.durationDays,
      },
    };
  }

  async getActiveSubscription(
    userId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Subscription | null> {
    const now = new Date();
    const subscription = await tx.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE as FinanceSubscriptionStatus,
      },
      orderBy: { endAt: 'desc' },
    });

    if (!subscription) {
      return null;
    }

    const validity = this.evaluateSubscriptionValidity(subscription, now);
    if (!validity.isValid) {
      if (validity.reason === 'EXPIRED') {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { status: SubscriptionStatus.EXPIRED as FinanceSubscriptionStatus },
        });
      }
      return null;
    }

    return subscription;
  }

  async getLatestSubscription(userId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { endAt: 'desc' },
    });
  }

  async getDiscountCandidate(
    userId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<
    | {
        subscription: Subscription;
        percent: number;
        remaining: number;
        used: number;
        total: number;
      }
    | null
  > {
    const subscription = await this.getActiveSubscription(userId, tx);
    if (!subscription) {
      return null;
    }

    const snapshot = await this.getSubscriptionDiscountSnapshot(tx, subscription);
    if (snapshot.percent <= 0 || snapshot.remaining <= 0) {
      return null;
    }

    return {
      subscription,
      percent: snapshot.percent,
      remaining: snapshot.remaining,
      used: snapshot.used,
      total: snapshot.total,
    };
  }

  async getDiscountStats(
    userId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<
    | {
        subscription: Subscription;
        percent: number;
        remaining: number;
        used: number;
        total: number;
      }
    | null
  > {
    const subscription = await this.getActiveSubscription(userId, tx);
    if (!subscription) {
      return null;
    }

    const snapshot = await this.getSubscriptionDiscountSnapshot(tx, subscription);

    return {
      subscription,
      percent: snapshot.percent,
      remaining: snapshot.remaining,
      used: snapshot.used,
      total: snapshot.total,
    };
  }

  async consumeSubscriptionDiscountForOrder(
    tx: Prisma.TransactionClient,
    params: { userId: string; orderId: string; subtotal: number },
  ): Promise<
    | {
        subscriptionId: string;
        percent: number;
        amount: number;
        remainingAfter: number;
        usedAfter: number;
        total: number;
      }
    | null
  > {
    const subscription = await this.getActiveSubscription(params.userId, tx);
    if (!subscription) {
      return null;
    }

    const percent = subscription.discountPercent ?? 0;
    if (percent <= 0) {
      return null;
    }

    await tx.$executeRaw`
      SELECT 1 FROM "finance"."user_subscriptions_v2"
      WHERE "id" = ${subscription.id}::uuid
      FOR UPDATE
    `;

    const plan = await tx.subscriptionPlan.findUnique({
      where: { id: subscription.planId },
      select: { discountQuota: true },
    });
    const total = plan?.discountQuota ?? 0;
    if (total <= 0) {
      return null;
    }

    const existingUsage = await tx.subscriptionDiscountUsage.findUnique({
      where: { orderId: params.orderId },
      select: {
        id: true,
        subscriptionId: true,
        userId: true,
        consumedAt: true,
        discountPercent: true,
        discountAmount: true,
      },
    });

    const usedBefore = await tx.subscriptionDiscountUsage.count({
      where: { subscriptionId: subscription.id, consumedAt: { not: null } },
    });

    if (existingUsage) {
      if (
        existingUsage.subscriptionId !== subscription.id ||
        existingUsage.userId !== params.userId
      ) {
        return null;
      }

      if (existingUsage.consumedAt) {
        const remainingAfter = Math.max(0, total - usedBefore);
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { discountRemaining: remainingAfter },
        });
        return {
          subscriptionId: subscription.id,
          percent: existingUsage.discountPercent,
          amount: existingUsage.discountAmount,
          remainingAfter,
          usedAfter: usedBefore,
          total,
        };
      }
    }

    if (usedBefore >= total) {
      if (existingUsage && !existingUsage.consumedAt) {
        await tx.subscriptionDiscountUsage.delete({
          where: { id: existingUsage.id },
        });
      }
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { discountRemaining: 0 },
      });
      return null;
    }

    const amount = Math.min(
      Math.floor((params.subtotal * percent) / 100),
      params.subtotal,
    );
    if (amount <= 0) {
      return null;
    }

    const consumedAt = new Date();
    if (existingUsage) {
      await tx.subscriptionDiscountUsage.update({
        where: { id: existingUsage.id },
        data: {
          discountPercent: percent,
          discountAmount: amount,
          consumedAt,
        },
      });
    } else {
      await tx.subscriptionDiscountUsage.create({
        data: {
          subscriptionId: subscription.id,
          orderId: params.orderId,
          userId: params.userId,
          discountPercent: percent,
          discountAmount: amount,
          consumedAt,
        },
      });
    }

    const remainingAfter = Math.max(0, total - (usedBefore + 1));
    await tx.subscription.update({
      where: { id: subscription.id },
      data: { discountRemaining: remainingAfter },
    });

    return {
      subscriptionId: subscription.id,
      percent,
      amount,
      remainingAfter,
      usedAfter: usedBefore + 1,
      total,
    };
  }

  async getSubscriptionPanel(userId: string, logsLimit = 20): Promise<{
    id?: string;
    status?: SubscriptionStatus;
    startAt?: string;
    endAt?: string;
    autoRenew?: boolean | null;
    remainingDays?: number;
    plan?: {
      id?: string;
      title?: string;
      price?: number;
      durationDays?: number;
      dailyDownloadLimit?: number;
      dailyFreeDownloadLimitWithSubscription?: number;
      discountPercent?: number | null;
      features?: Record<string, unknown> | null;
    };
    quota?: {
      downloadsLimitSnapshot: number;
      downloadsUsed: number;
      downloadsRemaining: number;
      resetAt: string;
    };
    today?: {
      freeLimit: number;
      freeUsedToday: number;
      freeRemainingToday: number;
      subLimit: number;
      subUsedToday: number;
      subRemainingToday: number;
    };
    discount?: {
      discountPercent: number;
      discountQuotaTotal: number;
      discountUsedInPeriod: number;
      discountRemainingInPeriod: number;
      discountQuotaLifetime: number;
      discountUsedLifetime: number;
      discountRemainingLifetime: number;
      quotaType: 'LIFETIME';
    };
    subscription?: {
      status?: SubscriptionStatus;
      plan?: {
        id?: string;
        title?: string;
        price?: number;
        durationDays?: number;
        dailyDownloadLimit?: number;
        dailyFreeDownloadLimitWithSubscription?: number;
        discountPercent?: number | null;
        features?: Record<string, unknown> | null;
      };
      startAt?: string;
      expiresAt?: string;
      isValid?: boolean;
    } | null;
    logs?: {
      productId: string;
      createdAt: string;
      status: 'SUCCESS' | 'FAILED';
      failReason?: string | null;
    }[];
  }> {
    const subscription = await this.getLatestSubscription(userId);
    const dateKey = getTehranDateKey();
    const freeUsage = await this.prisma.financeDownloadUsageDaily.findUnique({
      where: { userId_dateKey: { userId, dateKey } },
    });
    const usedFree = freeUsage?.usedFree ?? 0;

    if (!subscription) {
      return {
        quota: {
          downloadsLimitSnapshot: 0,
          downloadsUsed: 0,
          downloadsRemaining: 0,
          resetAt: getTehranResetAt(dateKey).toISOString(),
        },
        today: {
          freeLimit: BASE_FREE_DAILY_LIMIT,
          freeUsedToday: usedFree,
          freeRemainingToday: Math.max(0, BASE_FREE_DAILY_LIMIT - usedFree),
          subLimit: 0,
          subUsedToday: 0,
          subRemainingToday: 0,
        },
        discount: {
          discountPercent: 0,
          discountQuotaTotal: 0,
          discountUsedInPeriod: 0,
          discountRemainingInPeriod: 0,
          discountQuotaLifetime: 0,
          discountUsedLifetime: 0,
          discountRemainingLifetime: 0,
          quotaType: 'LIFETIME',
        },
        subscription: null,
        logs: [],
      };
    }

    const now = new Date();
    const validity = this.evaluateSubscriptionValidity(subscription, now);
    if (!validity.isValid && validity.reason === 'EXPIRED') {
      if (
        (subscription.status as FinanceSubscriptionStatus) ===
        (SubscriptionStatus.ACTIVE as FinanceSubscriptionStatus)
      ) {
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: SubscriptionStatus.EXPIRED as FinanceSubscriptionStatus },
        });
      }
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: subscription.planId },
    });

    const usage = await this.prisma.subscriptionDailyQuotaUsage.findUnique({
      where: { userId_dateKey: { userId, dateKey } },
    });
    const limit = usage?.downloadsLimitSnapshot ?? plan?.dailyDownloadLimit ?? 0;
    const used = usage?.downloadsUsed ?? 0;

    const logs = await this.prisma.subscriptionDownloadLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: logsLimit,
      select: {
        productId: true,
        createdAt: true,
        status: true,
        failReason: true,
      },
    });

    const remainingDays =
      subscription.endAt > now
        ? Math.max(
            0,
            Math.ceil(
              (subscription.endAt.getTime() - now.getTime()) / 86_400_000,
            ),
          )
        : 0;

    const discountStats = await this.getDiscountStats(userId);
    const discountPercent = discountStats?.percent ?? 0;
    const discountRemaining = discountStats?.remaining ?? 0;
    const discountUsed = discountStats?.used ?? 0;
    const discountTotal = discountStats?.total ?? 0;

    const isValid = this.evaluateSubscriptionValidity(subscription, now).isValid;
    const freeLimit = isValid
      ? plan?.dailyFreeDownloadLimitWithSubscription ?? BASE_FREE_DAILY_LIMIT
      : BASE_FREE_DAILY_LIMIT;

    return {
      id: subscription.id,
      status: subscription.status as SubscriptionStatus,
      startAt: subscription.startAt.toISOString(),
      endAt: subscription.endAt.toISOString(),
      autoRenew: subscription.autoRenew ?? null,
      remainingDays,
      plan: plan
        ? {
            id: plan.id,
            title: plan.title,
            price: plan.price,
            durationDays: plan.durationDays,
            dailyDownloadLimit: plan.dailyDownloadLimit,
            dailyFreeDownloadLimitWithSubscription:
              plan.dailyFreeDownloadLimitWithSubscription,
            discountPercent: plan.discountPercent ?? null,
            features: (plan.features ?? null) as Record<string, unknown> | null,
          }
        : undefined,
      quota: {
        downloadsLimitSnapshot: limit,
        downloadsUsed: used,
        downloadsRemaining: Math.max(0, limit - used),
        resetAt: getTehranResetAt(dateKey).toISOString(),
      },
      today: {
        freeLimit,
        freeUsedToday: usedFree,
        freeRemainingToday: Math.max(0, freeLimit - usedFree),
        subLimit: isValid ? limit : 0,
        subUsedToday: isValid ? used : 0,
        subRemainingToday: isValid ? Math.max(0, limit - used) : 0,
      },
      discount: {
        discountPercent: isValid ? discountPercent : 0,
        discountQuotaTotal: isValid ? discountTotal : 0,
        discountUsedInPeriod: isValid ? discountUsed : 0,
        discountRemainingInPeriod: isValid ? discountRemaining : 0,
        discountQuotaLifetime: isValid ? discountTotal : 0,
        discountUsedLifetime: isValid ? discountUsed : 0,
        discountRemainingLifetime: isValid ? discountRemaining : 0,
        quotaType: 'LIFETIME',
      },
      subscription: {
        status: subscription.status as SubscriptionStatus,
        plan: plan
          ? {
              id: plan.id,
              title: plan.title,
              price: plan.price,
              durationDays: plan.durationDays,
              dailyDownloadLimit: plan.dailyDownloadLimit,
              dailyFreeDownloadLimitWithSubscription:
                plan.dailyFreeDownloadLimitWithSubscription,
              discountPercent: plan.discountPercent ?? null,
              features: (plan.features ?? null) as Record<string, unknown> | null,
            }
          : undefined,
        startAt: subscription.startAt.toISOString(),
        expiresAt: subscription.endAt.toISOString(),
        isValid,
      },
      logs: logs.map((row) => ({
        productId: row.productId.toString(),
        createdAt: row.createdAt.toISOString(),
        status: row.status as 'SUCCESS' | 'FAILED',
        failReason: row.failReason ?? null,
      })),
    };
  }

  evaluateSubscriptionValidity(
    subscription: Subscription,
    now: Date = new Date(),
  ): { isValid: boolean; reason?: 'INACTIVE' | 'EXPIRED' } {
    if ((subscription.status as FinanceSubscriptionStatus) !== SubscriptionStatus.ACTIVE) {
      return { isValid: false, reason: 'INACTIVE' };
    }

    if (subscription.startAt > now) {
      return { isValid: false, reason: 'INACTIVE' };
    }

    if (subscription.endAt <= now) {
      return { isValid: false, reason: 'EXPIRED' };
    }

    return { isValid: true };
  }

  async createSubscriptionOrder(
    userId: string,
    dto: LegacyPurchaseSubscriptionDto,
  ): Promise<FinanceOrder> {
    if (!SUBSCRIPTION_DURATIONS_MONTHS.includes(dto.durationMonths)) {
      throw new BadRequestException('Invalid subscription duration.');
    }

    const plan = await this.prisma.financeSubscriptionPlan.findFirst({
      where: { code: dto.planCode, isActive: true },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found.');
    }

    const planCode = plan.code as SubscriptionPlanCode;
    const monthlyPrice = SUBSCRIPTION_PLAN_PRICING[planCode];
    const amount = monthlyPrice * dto.durationMonths;

    return this.prisma.financeOrder.create({
      data: {
        userId,
        status: OrderStatus.PENDING_PAYMENT as FinanceOrderStatus,
        orderKind: OrderKind.SUBSCRIPTION as FinanceOrderKind,
        subtotal: amount,
        discountType: DiscountType.NONE as FinanceDiscountType,
        discountValue: 0,
        discountAmount: 0,
        discountSource: 'NONE',
        couponCode: null,
        discountReason: 'No discount applied.',
        total: amount,
        currency: 'TOMAN',
        subscriptionPlanId: plan.id,
        subscriptionDurationMonths: dto.durationMonths,
        paidAt: null,
      },
    });
  }

  async createSubscriptionPurchase(
    userId: string,
    dto: SubscriptionPurchaseDto,
  ): Promise<{
    purchase: FinanceSubscriptionPurchase;
    plan: SubscriptionPlan;
  }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT 1 FROM "core"."users"
        WHERE "id" = ${userId}::uuid
        FOR UPDATE
      `;

      const plan = await tx.subscriptionPlan.findUnique({
        where: { id: dto.planId },
      });

      if (!plan) {
        throw new NotFoundException('Subscription plan not found.');
      }

      if (!plan.isActive) {
        throw new ConflictException('Subscription plan is inactive.');
      }

      const originalAmount = plan.price;
      const durationMonths = Math.max(
        1,
        Math.ceil((plan.durationDays ?? 0) / 30),
      );

      let discountApplied = false;
      let discountPercent = 0;
      let discountAmount = 0;
      let finalAmount = originalAmount;

      const planDiscountPercent = plan.discountPercent ?? 0;
      const planDiscountQuota = plan.discountQuota ?? 0;

      if (planDiscountPercent > 0 && planDiscountQuota > 0) {
        const usedDiscounts = await tx.financeSubscriptionPurchase.count({
          where: {
            userId,
            subscriptionPlanId: plan.id,
            discountApplied: true,
          },
        });

        const remainingDiscounts = Math.max(0, planDiscountQuota - usedDiscounts);
        if (remainingDiscounts > 0) {
          discountAmount = Math.min(
            Math.floor((originalAmount * planDiscountPercent) / 100),
            originalAmount,
          );
          if (discountAmount > 0) {
            discountApplied = true;
            discountPercent = planDiscountPercent;
            finalAmount = Math.max(0, originalAmount - discountAmount);
          }
        }
      }

      const purchase = await tx.financeSubscriptionPurchase.create({
        data: {
          userId,
          planId: null,
          subscriptionPlanId: plan.id,
          status: FinanceSubscriptionPurchaseStatus.PENDING,
          originalAmount,
          amount: finalAmount,
          discountApplied,
          discountPercent,
          discountAmount,
          currency: 'TOMAN',
          durationMonths,
        },
      });

      return { purchase, plan };
    });
  }

  async activateSubscriptionFromOrder(
    tx: Prisma.TransactionClient,
    order: FinanceOrder,
  ): Promise<Subscription> {
    if (!order.subscriptionPlanId || !order.subscriptionDurationMonths) {
      throw new BadRequestException('Order is missing subscription details.');
    }

    return this.activateSubscription(
      tx,
      order.userId,
      order.subscriptionPlanId,
      order.subscriptionDurationMonths,
    );
  }

  async activateSubscriptionFromPurchase(
    tx: Prisma.TransactionClient,
    purchase: FinanceSubscriptionPurchase,
  ): Promise<Subscription> {
    if (!purchase.subscriptionPlanId) {
      // v2 invariant: activation must use subscription_plan_id; legacy plan_id is invalid here.
      throw new InternalServerErrorException(
        'Invariant violation: subscriptionPlanId is required for subscription activation.',
      );
    }
    return this.activateSubscription(
      tx,
      purchase.userId,
      purchase.subscriptionPlanId,
      purchase.durationMonths,
    );
  }


  async getPlanById(id: string): Promise<SubscriptionPlan> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found.');
    }
    return plan;
  }

  private async activateSubscription(
    tx: Prisma.TransactionClient,
    userId: string,
    subscriptionPlanId: string,
    durationMonths: number,
  ): Promise<Subscription> {
    const plan = await tx.subscriptionPlan.findUnique({
      where: { id: subscriptionPlanId },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found.');
    }

    const now = new Date();
    const existing = await tx.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE as FinanceSubscriptionStatus,
      },
      orderBy: { endAt: 'desc' },
    });

    const startAt = existing && existing.endAt > now ? existing.endAt : now;
    const endAt = addMonths(startAt, durationMonths);

    if (existing && existing.endAt > now) {
      return tx.subscription.update({
        where: { id: existing.id },
        data: {
          endAt,
          planId: plan.id,
          planTitle: plan.title,
          price: plan.price,
          durationDays: plan.durationDays,
          dailyDownloadLimit: plan.dailyDownloadLimit,
          dailyFreeDownloadLimitWithSubscription:
            plan.dailyFreeDownloadLimitWithSubscription,
          discountPercent: plan.discountPercent ?? null,
          discountRemaining: plan.discountQuota ?? 0,
          status: SubscriptionStatus.ACTIVE as FinanceSubscriptionStatus,
        },
      });
    }

    return tx.subscription.create({
      data: {
        userId,
        planId: plan.id,
        planTitle: plan.title,
        price: plan.price,
        durationDays: plan.durationDays,
        dailyDownloadLimit: plan.dailyDownloadLimit,
        dailyFreeDownloadLimitWithSubscription:
          plan.dailyFreeDownloadLimitWithSubscription,
        discountPercent: plan.discountPercent ?? null,
        discountRemaining: plan.discountQuota ?? 0,
        startAt,
        endAt,
        status: SubscriptionStatus.ACTIVE as FinanceSubscriptionStatus,
      },
    });
  }

  private async getSubscriptionDiscountSnapshot(
    tx: Prisma.TransactionClient | PrismaService,
    subscription: Subscription,
  ): Promise<{ percent: number; total: number; used: number; remaining: number }> {
    const percent = subscription.discountPercent ?? 0;
    if (percent <= 0) {
      return { percent: 0, total: 0, used: 0, remaining: 0 };
    }

    const plan = await tx.subscriptionPlan.findUnique({
      where: { id: subscription.planId },
      select: { discountQuota: true },
    });
    const total = plan?.discountQuota ?? 0;
    if (total <= 0) {
      return { percent, total: 0, used: 0, remaining: 0 };
    }

    const used = await tx.subscriptionDiscountUsage.count({
      where: { subscriptionId: subscription.id, consumedAt: { not: null } },
    });
    const remaining = Math.max(0, total - used);

    return { percent, total, used, remaining };
  }
}
