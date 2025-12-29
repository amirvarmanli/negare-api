import {
  BadRequestException,
  Injectable,
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
import type { PurchaseSubscriptionDto } from '@app/finance/subscriptions/dto/purchase-subscription.dto';
import {
  FinanceDiscountType,
  FinanceOrder,
  FinanceOrderKind,
  FinanceOrderStatus,
  FinanceSubscriptionPlan,
  FinanceSubscriptionPurchase,
  FinanceSubscriptionPurchaseStatus,
  FinanceUserSubscription,
  FinanceSubscriptionPlanCode as PrismaSubscriptionPlanCode,
  FinanceSubscriptionStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly defaultDurationMonths = 1;

  async listPlans(): Promise<FinanceSubscriptionPlan[]> {
    return this.prisma.financeSubscriptionPlan.findMany({
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
    dto: PurchaseSubscriptionDto,
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
    planId: string,
  ): Promise<{
    purchase: FinanceSubscriptionPurchase;
    planTitle: string;
  }> {
    const plan = await this.prisma.financeSubscriptionPlan.findFirst({
      where: { id: planId, isActive: true },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found.');
    }

    const planCode = plan.code as SubscriptionPlanCode;
    const monthlyPrice = SUBSCRIPTION_PLAN_PRICING[planCode];
    const amount = monthlyPrice * this.defaultDurationMonths;

    const purchase = await this.prisma.financeSubscriptionPurchase.create({
      data: {
        userId,
        planId: plan.id,
        status: FinanceSubscriptionPurchaseStatus.PENDING,
        amount,
        currency: 'TOMAN',
        durationMonths: this.defaultDurationMonths,
      },
    });

    return {
      purchase,
      planTitle: `Plan ${planCode}`,
    };
  }

  async activateSubscriptionFromOrder(
    tx: Prisma.TransactionClient,
    order: FinanceOrder,
  ): Promise<FinanceUserSubscription> {
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
  ): Promise<FinanceUserSubscription> {
    return this.activateSubscription(
      tx,
      purchase.userId,
      purchase.planId,
      purchase.durationMonths,
    );
  }

  async getPlanByCode(code: SubscriptionPlanCode): Promise<FinanceSubscriptionPlan> {
    const plan = await this.prisma.financeSubscriptionPlan.findFirst({
      where: { code: code as PrismaSubscriptionPlanCode },
    });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found.');
    }
    return plan;
  }

  async getPlanById(id: string): Promise<FinanceSubscriptionPlan> {
    const plan = await this.prisma.financeSubscriptionPlan.findUnique({
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
    planId: string,
    durationMonths: number,
  ): Promise<FinanceUserSubscription> {
    const plan = await tx.financeSubscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found.');
    }

    const now = new Date();
    const existing = await tx.financeUserSubscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE as FinanceSubscriptionStatus,
      },
      orderBy: { endAt: 'desc' },
    });

    const startAt = existing && existing.endAt > now ? existing.endAt : now;
    const endAt = addMonths(startAt, durationMonths);

    if (existing && existing.endAt > now) {
      return tx.financeUserSubscription.update({
        where: { id: existing.id },
        data: { endAt, planId: plan.id },
      });
    }

    return tx.financeUserSubscription.create({
      data: {
        userId,
        planId: plan.id,
        startAt,
        endAt,
        status: SubscriptionStatus.ACTIVE as FinanceSubscriptionStatus,
      },
    });
  }
}
