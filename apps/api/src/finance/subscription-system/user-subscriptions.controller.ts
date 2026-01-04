import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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
    return this.toDto(subscription);
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
    return this.toDto(subscription);
  }

  private toDto(subscription: Subscription): UserSubscriptionDto {
    return {
      id: subscription.id,
      planId: subscription.planId,
      planTitle: subscription.planTitle,
      price: subscription.price,
      durationDays: subscription.durationDays,
      dailySubscriptionDownloadLimit: subscription.dailySubscriptionDownloadLimit,
      dailyFreeDownloadLimitWithSubscription:
        subscription.dailyFreeDownloadLimitWithSubscription,
      discountPercent: subscription.discountPercent ?? null,
      discountRemaining: subscription.discountRemaining,
      status: this.mapStatus(subscription.status),
      startAt: subscription.startAt.toISOString(),
      endAt: subscription.endAt.toISOString(),
    };
  }

  private mapStatus(status: Subscription['status']): SubscriptionStatus {
    if (status === 'CANCELLED') {
      return SubscriptionStatus.CANCELED;
    }
    return status as SubscriptionStatus;
  }

  private toPlanDto(plan: SubscriptionPlan): SubscriptionPlanDto {
    return {
      id: plan.id,
      title: plan.title,
      price: plan.price,
      durationDays: plan.durationDays,
      dailySubscriptionDownloadLimit: plan.dailySubscriptionDownloadLimit,
      dailyFreeDownloadLimitWithSubscription:
        plan.dailyFreeDownloadLimitWithSubscription,
      description: plan.description ?? null,
      isActive: plan.isActive,
      discountPercent: plan.discountPercent ?? null,
      discountQuota: plan.discountQuota ?? null,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }
}
