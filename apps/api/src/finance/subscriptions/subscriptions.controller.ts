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
import { PurchaseSubscriptionDto } from '@app/finance/subscriptions/dto/purchase-subscription.dto';
import { OrderResponseDto } from '@app/finance/orders/dto/order-response.dto';
import { SubscriptionMeDto } from '@app/finance/subscriptions/dto/subscription-me.dto';
import type { FinanceSubscriptionPlan, FinanceOrder } from '@prisma/client';
import { SubscriptionPlanCode } from '@app/finance/common/finance.enums';

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
    const subscription = await this.subscriptionsService.getActiveSubscription(
      userId,
    );
    if (!subscription) {
      return {};
    }
    const plan = await this.subscriptionsService.getPlanById(
      subscription.planId,
    );
    return {
      id: subscription.id,
      planCode: plan.code as SubscriptionPlanCode,
      dailySubLimit: plan.dailySubLimit,
      dailyFreeLimit: plan.dailyFreeLimit,
      status: subscription.status as SubscriptionMeDto['status'],
      startAt: subscription.startAt.toISOString(),
      endAt: subscription.endAt.toISOString(),
    };
  }

  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a subscription order.' })
  @ApiOkResponse({ type: OrderResponseDto })
  async purchase(
    @Body() dto: PurchaseSubscriptionDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<OrderResponseDto> {
    const userId = requireUserId(user);
    const order = await this.subscriptionsService.createSubscriptionOrder(
      userId,
      dto,
    );
    return this.toOrderResponse(order);
  }

  private toPlanDto(plan: FinanceSubscriptionPlan): SubscriptionPlanDto {
    return {
      id: plan.id,
      code: plan.code as SubscriptionPlanCode,
      dailySubLimit: plan.dailySubLimit,
      dailyFreeLimit: plan.dailyFreeLimit,
      isActive: plan.isActive,
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
