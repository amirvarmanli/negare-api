import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { SUBSCRIPTION_BASE_FREE_DAILY_LIMIT } from '@app/finance/subscription-system/subscription-system.constants';
import type { SubscriptionPlan } from '@prisma/client';
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

  async createPlan(dto: CreateSubscriptionPlanDto): Promise<SubscriptionPlan> {
    this.assertFreeLimit(dto.dailyFreeDownloadLimitWithSubscription);
    this.assertDiscountConfig(dto.discountPercent, dto.discountQuota);

    return this.prisma.subscriptionPlan.create({
      data: {
        title: dto.title,
        price: dto.price,
        durationDays: dto.durationDays,
        dailySubscriptionDownloadLimit: dto.dailySubscriptionDownloadLimit,
        dailyFreeDownloadLimitWithSubscription: dto.dailyFreeDownloadLimitWithSubscription,
        description: dto.description,
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
        dailySubscriptionDownloadLimit: dto.dailySubscriptionDownloadLimit ?? undefined,
        dailyFreeDownloadLimitWithSubscription:
          dto.dailyFreeDownloadLimitWithSubscription ?? undefined,
        description: dto.description ?? undefined,
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
    if (limit < SUBSCRIPTION_BASE_FREE_DAILY_LIMIT) {
      throw new BadRequestException(
        `dailyFreeDownloadLimitWithSubscription must be greater than or equal to the free user daily limit (${SUBSCRIPTION_BASE_FREE_DAILY_LIMIT})`,
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
