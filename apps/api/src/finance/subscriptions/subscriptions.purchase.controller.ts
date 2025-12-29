import { Body, Controller, Post, UseGuards } from '@nestjs/common';
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
import {
  SubscriptionPurchaseDto,
  SubscriptionPurchaseResponseDto,
} from '@app/finance/subscriptions/dto/subscription-purchase.dto';

@ApiTags('Finance / Subscription')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsPurchaseController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('purchase')
  @ApiOperation({ summary: 'Create a subscription purchase.' })
  @ApiOkResponse({ type: SubscriptionPurchaseResponseDto })
  async purchase(
    @Body() dto: SubscriptionPurchaseDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<SubscriptionPurchaseResponseDto> {
    const userId = requireUserId(user);
    const result = await this.subscriptionsService.createSubscriptionPurchase(
      userId,
      dto.planId,
    );
    return {
      purchaseId: result.purchase.id,
      amount: result.purchase.amount,
      planTitle: result.planTitle,
    };
  }
}
