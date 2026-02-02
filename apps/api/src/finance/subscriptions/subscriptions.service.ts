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
  SUBSCRIPTION_DURATIONS_MONTHS,
  SUBSCRIPTION_PLAN_PRICING,
} from '@app/finance/common/finance.constants';
import { DiscountType, OrderKind, OrderStatus } from '@app/finance/common/finance.enums';
import { addMonths } from '@app/finance/common/date.utils';
import type { LegacyPurchaseSubscriptionDto } from '@app/finance/subscriptions/dto/purchase-subscription.dto';
import type { SubscriptionPurchaseDto } from '@app/finance/subscriptions/dto/subscription-purchase.dto';
import {
  FinanceDiscountType,
  FinanceOrder,
  FinanceOrderKind,
  FinanceOrderStatus,
  FinanceSubscriptionPurchase,
  FinanceSubscriptionPurchaseStatus,
  FinanceUserSubscription,
  FinanceSubscriptionStatus,
  Prisma,
  Subscription,
  SubscriptionPlan,
} from '@prisma/client';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly defaultDurationMonths = 1;

  async listPlans(): Promise<SubscriptionPlan[]> {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
    });
  }

  async getActiveSubscription(
    userId: string,
  ): Promise<FinanceUserSubscription | null> {
    const now = new Date();
    const subscription = await this.prisma.financeUserSubscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE as FinanceSubscriptionStatus },
      orderBy: { endAt: 'desc' },
    });

    if (!subscription) {
      return null;
    }

    if (subscription.endAt <= now) {
      await this.prisma.financeUserSubscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.EXPIRED as FinanceSubscriptionStatus },
      });
      return null;
    }

    return subscription;
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
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found.');
    }

    if (!plan.isActive) {
      throw new ConflictException('Subscription plan is inactive.');
    }

    const amount = plan.price;
    const durationMonths = Math.max(
      1,
      Math.ceil((plan.durationDays ?? 0) / 30),
    );

    const purchase = await this.prisma.financeSubscriptionPurchase.create({
      data: {
        userId,
        planId: null,
        subscriptionPlanId: plan.id,
        status: FinanceSubscriptionPurchaseStatus.PENDING,
        amount,
        currency: 'TOMAN',
        durationMonths,
      },
    });

    return { purchase, plan };
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
          dailySubscriptionDownloadLimit: plan.dailySubscriptionDownloadLimit,
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
  }
}
