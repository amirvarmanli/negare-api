import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { Roles } from '@app/common/decorators/roles.decorator';
import { Permissions } from '@app/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@app/common/guards/permissions.guard';
import { RoleName, SubscriptionPlan } from '@prisma/client';
import { SubscriptionPlansService } from '@app/finance/subscription-system/subscription-plans.service';
import { SubscriptionPlanDto } from '@app/finance/subscription-system/dto/subscription-plan.dto';
import { CreateSubscriptionPlanDto } from '@app/finance/subscription-system/dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from '@app/finance/subscription-system/dto/update-subscription-plan.dto';

@ApiTags('Finance / Subscription Plans')
@Controller('admin/subscription-plans')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
@Roles(RoleName.admin)
@Permissions('admin.finance:manage')
export class SubscriptionPlansController {
  constructor(private readonly plansService: SubscriptionPlansService) {}

  @Get()
  @ApiOperation({ summary: 'List subscription plans (admin).' })
  @ApiOkResponse({ type: [SubscriptionPlanDto] })
  async listPlans(): Promise<SubscriptionPlanDto[]> {
    const plans = await this.plansService.listPlans();
    return plans.map((plan) => this.toDto(plan));
  }

  @Post()
  @ApiOperation({ summary: 'Create subscription plan (admin).' })
  @ApiCreatedResponse({ type: SubscriptionPlanDto })
  async createPlan(
    @Body() dto: CreateSubscriptionPlanDto,
  ): Promise<SubscriptionPlanDto> {
    const plan = await this.plansService.createPlan(dto);
    return this.toDto(plan);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update subscription plan (admin).' })
  @ApiOkResponse({ type: SubscriptionPlanDto })
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlanDto> {
    const plan = await this.plansService.updatePlan(id, dto);
    return this.toDto(plan);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete subscription plan (admin).' })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePlan(@Param('id') id: string): Promise<void> {
    await this.plansService.deletePlan(id);
  }

  private toDto(plan: SubscriptionPlan): SubscriptionPlanDto {
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
