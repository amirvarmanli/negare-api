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
import { SubscriptionsService } from '@app/finance/subscriptions/subscriptions.service';
import { SubscriptionPlanDto } from '@app/finance/subscriptions/dto/subscription-plan.dto';
import { LegacyPurchaseSubscriptionDto } from '@app/finance/subscriptions/dto/purchase-subscription.dto';
import { OrderResponseDto } from '@app/finance/orders/dto/order-response.dto';
import { SubscriptionMeDto } from '@app/finance/subscriptions/dto/subscription-me.dto';
import type { SubscriptionPlan, FinanceOrder } from '@prisma/client';

@ApiTags('Finance / Subscription')
@Controller('subscription')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List active subscription plans.' })
  @ApiOkResponse({ type: [SubscriptionPlanDto] })
  async listPlans(): Promise<SubscriptionPlanDto[]> {
    const plans = await this.subscriptionsService.listPlans();
    return plans.map((plan) => this.toPlanDto(plan));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user subscription.' })
  @ApiOkResponse({ type: SubscriptionMeDto })
  async me(
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<SubscriptionMeDto> {
    const userId = requireUserId(user);
    return this.subscriptionsService.getSubscriptionPanel(userId);
  }

  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a subscription order.' })
  @ApiOkResponse({ type: OrderResponseDto })
  async purchase(
    @Body() dto: LegacyPurchaseSubscriptionDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<OrderResponseDto> {
    const userId = requireUserId(user);
    const order = await this.subscriptionsService.createSubscriptionOrder(
      userId,
      dto,
    );
    return this.toOrderResponse(order);
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

  private toOrderResponse(order: FinanceOrder): OrderResponseDto {
    return {
      id: order.id,
      status: order.status as OrderResponseDto['status'],
      orderKind: order.orderKind as OrderResponseDto['orderKind'],
      subtotal: order.subtotal,
      discountType: order.discountType as OrderResponseDto['discountType'],
      discountValue: order.discountValue,
      total: order.total,
      currency: 'TOMAN',
      items: [],
      createdAt: order.createdAt.toISOString(),
      paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    };
  }
}
