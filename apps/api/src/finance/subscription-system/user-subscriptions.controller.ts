import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { requireUserId } from '@app/catalog/utils/current-user.util';
import { UserSubscriptionsService } from '@app/finance/subscription-system/user-subscriptions.service';
import { SubscriptionPlansService } from '@app/finance/subscription-system/subscription-plans.service';
import { PurchaseSubscriptionDto } from '@app/finance/subscription-system/dto/purchase-subscription.dto';
import { UserSubscriptionDto } from '@app/finance/subscription-system/dto/user-subscription.dto';
import { SubscriptionStatus } from '@app/finance/subscription-system/subscription-system.enums';
import { SubscriptionPlanDto } from '@app/finance/subscription-system/dto/subscription-plan.dto';
import { SubscriptionDiscountStatsDto } from '@app/finance/subscription-system/dto/subscription-discount-stats.dto';
import type { Subscription, SubscriptionPlan } from '@prisma/client';

@ApiTags('Finance / Subscriptions')
@Controller('subscriptions')
export class UserSubscriptionsController {
  constructor(
    private readonly subscriptionsService: UserSubscriptionsService,
    private readonly plansService: SubscriptionPlansService,
  ) {}

  @Get('plans')
  @ApiOperation({ summary: 'List active subscription plans.' })
  @ApiOkResponse({ type: [SubscriptionPlanDto] })
  async listPlans(): Promise<SubscriptionPlanDto[]> {
    const plans = await this.plansService.listActivePlans();
    return plans.map((plan) => this.toPlanDto(plan));
  }

  @Get('plans/:id/discount-stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get subscription plan discount stats for the current user.' })
  @ApiOkResponse({ type: SubscriptionDiscountStatsDto })
  async getDiscountStats(
    @Param('id') planId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<SubscriptionDiscountStatsDto> {
    const userId = requireUserId(user);
    return this.plansService.getDiscountStatsForUser(userId, planId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current active subscription.' })
  @ApiOkResponse({ type: UserSubscriptionDto })
  async me(
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<UserSubscriptionDto | null> {
    const userId = requireUserId(user);
    const subscription = await this.subscriptionsService.getActiveSubscription(
      userId,
    );
    if (!subscription) {
      return null;
    }
    const discountRemaining =
      await this.subscriptionsService.getDiscountRemaining(subscription);
    return this.toDto(subscription, discountRemaining);
  }

  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Purchase a subscription.' })
  @ApiOkResponse({ type: UserSubscriptionDto })
  async purchase(
    @Body() dto: PurchaseSubscriptionDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<UserSubscriptionDto> {
    const userId = requireUserId(user);
    const subscription = await this.subscriptionsService.purchaseSubscription(
      userId,
      dto.planId,
    );
    const discountRemaining =
      await this.subscriptionsService.getDiscountRemaining(subscription);
    return this.toDto(subscription, discountRemaining);
  }

  private toDto(
    subscription: Subscription,
    discountRemainingOverride: number,
  ): UserSubscriptionDto {
    return {
      id: subscription.id,
      planId: subscription.planId,
      planTitle: subscription.planTitle,
      price: subscription.price,
      durationDays: subscription.durationDays,
      dailyDownloadLimit: subscription.dailyDownloadLimit,
      dailyFreeDownloadLimitWithSubscription:
        subscription.dailyFreeDownloadLimitWithSubscription,
      discountPercent: subscription.discountPercent ?? null,
      discountRemaining: discountRemainingOverride,
      status: this.mapStatus(subscription.status),
      startAt: subscription.startAt.toISOString(),
      endAt: subscription.endAt.toISOString(),
    };
  }

  private mapStatus(status: Subscription['status']): SubscriptionStatus {
    if (status === 'CANCELED') {
      return SubscriptionStatus.CANCELED;
    }
    if (status === 'PAUSED') {
      return SubscriptionStatus.PAUSED;
    }
    return status as SubscriptionStatus;
  }

  private toPlanDto(plan: SubscriptionPlan): SubscriptionPlanDto {
    return {
      id: plan.id,
      title: plan.title,
      price: plan.price,
      durationDays: plan.durationDays,
      dailyDownloadLimit: plan.dailyDownloadLimit,
      dailyFreeDownloadLimitWithSubscription:
        plan.dailyFreeDownloadLimitWithSubscription,
      description: plan.description ?? null,
      isActive: plan.isActive,
      discountPercent: plan.discountPercent ?? null,
      features: (plan.features ?? null) as Record<string, unknown> | null,
      discountQuota: plan.discountQuota ?? null,
      discountQuotaType: 'LIFETIME',
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }
}
