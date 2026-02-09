import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { BASE_FREE_DAILY_LIMIT } from '@app/finance/common/finance.constants';
import { Prisma } from '@prisma/client';
import { SubscriptionStatus } from '@app/finance/subscription-system/subscription-system.enums';
import type { SubscriptionPlan } from '@prisma/client';
import type { FinanceSubscriptionStatus } from '@prisma/client';
import type { CreateSubscriptionPlanDto } from '@app/finance/subscription-system/dto/create-subscription-plan.dto';
import type { UpdateSubscriptionPlanDto } from '@app/finance/subscription-system/dto/update-subscription-plan.dto';

@Injectable()
export class SubscriptionPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlans(): Promise<SubscriptionPlan[]> {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async listActivePlans(): Promise<SubscriptionPlan[]> {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPlanById(id: string): Promise<SubscriptionPlan> {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found.');
    }
    return plan;
  }

  async getDiscountStatsForUser(
    userId: string,
    planId: string,
  ): Promise<{
    discountPercent: number;
    discountQuota: number;
    usedDiscounts: number;
    remainingDiscounts: number;
    isDiscountActive: boolean;
    quotaType: 'LIFETIME';
  }> {
    const plan = await this.getPlanById(planId);
    const discountPercent = plan.discountPercent ?? 0;
    const discountQuota = plan.discountQuota ?? 0;

    let usedDiscounts = 0;
    if (discountPercent > 0 && discountQuota > 0) {
      const now = new Date();
      const activeSubscription = await this.prisma.subscription.findFirst({
        where: {
          userId,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE as FinanceSubscriptionStatus,
          endAt: { gt: now },
        },
        orderBy: { endAt: 'desc' },
        select: { id: true },
      });

      if (activeSubscription) {
        usedDiscounts = await this.prisma.subscriptionDiscountUsage.count({
          where: {
            subscriptionId: activeSubscription.id,
            consumedAt: { not: null },
          },
        });
      }
    }

    const remainingDiscounts = Math.max(0, discountQuota - usedDiscounts);
    const isDiscountActive = discountPercent > 0 && remainingDiscounts > 0;

    return {
      discountPercent,
      discountQuota,
      usedDiscounts,
      remainingDiscounts,
      isDiscountActive,
      quotaType: 'LIFETIME',
    };
  }

  async createPlan(dto: CreateSubscriptionPlanDto): Promise<SubscriptionPlan> {
    this.assertFreeLimit(dto.dailyFreeDownloadLimitWithSubscription);
    this.assertDiscountConfig(dto.discountPercent, dto.discountQuota);

    return this.prisma.subscriptionPlan.create({
      data: {
        title: dto.title,
        price: dto.price,
        durationDays: dto.durationDays,
        dailyDownloadLimit: dto.dailyDownloadLimit,
        dailyFreeDownloadLimitWithSubscription: dto.dailyFreeDownloadLimitWithSubscription,
        description: dto.description,
        features:
          dto.features !== undefined
            ? (dto.features as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput)
            : undefined,
        isActive: dto.isActive,
        discountPercent: dto.discountPercent ?? null,
        discountQuota: dto.discountQuota ?? null,
      },
    });
  }

  async updatePlan(id: string, dto: UpdateSubscriptionPlanDto): Promise<SubscriptionPlan> {
    if (dto.dailyFreeDownloadLimitWithSubscription !== undefined) {
      this.assertFreeLimit(dto.dailyFreeDownloadLimitWithSubscription);
    }
    this.assertDiscountConfig(dto.discountPercent, dto.discountQuota);

    await this.getPlanById(id);

    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        price: dto.price ?? undefined,
        durationDays: dto.durationDays ?? undefined,
        dailyDownloadLimit: dto.dailyDownloadLimit ?? undefined,
        dailyFreeDownloadLimitWithSubscription:
          dto.dailyFreeDownloadLimitWithSubscription ?? undefined,
        description: dto.description ?? undefined,
        features:
          dto.features !== undefined
            ? (dto.features as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput)
            : undefined,
        isActive: dto.isActive ?? undefined,
        discountPercent: dto.discountPercent ?? undefined,
        discountQuota: dto.discountQuota ?? undefined,
      },
    });
  }

  async deletePlan(id: string): Promise<void> {
    await this.getPlanById(id);
    await this.prisma.subscriptionPlan.delete({ where: { id } });
  }

  private assertFreeLimit(limit: number): void {
    if (limit < BASE_FREE_DAILY_LIMIT) {
      throw new BadRequestException(
        `dailyFreeDownloadLimitWithSubscription must be greater than or equal to the free user daily limit (${BASE_FREE_DAILY_LIMIT})`,
      );
    }
  }

  private assertDiscountConfig(
    discountPercent?: number | null,
    discountQuota?: number | null,
  ): void {
    if (
      discountPercent !== undefined &&
      discountPercent !== null &&
      (discountPercent < 1 || discountPercent > 100)
    ) {
      throw new BadRequestException('Discount percent must be 1-100.');
    }
    if (
      discountQuota !== undefined &&
      discountQuota !== null &&
      discountQuota < 1
    ) {
      throw new BadRequestException('Discount quota must be at least 1.');
    }
  }
}
