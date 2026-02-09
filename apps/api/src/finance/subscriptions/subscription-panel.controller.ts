import { Controller, Get, UseGuards } from '@nestjs/common';
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
import { SubscriptionMeDto } from '@app/finance/subscriptions/dto/subscription-me.dto';
import { SubscriptionStatusDto } from '@app/finance/subscriptions/dto/subscription-status.dto';

@ApiTags('Finance / Subscription')
@Controller('me')
export class SubscriptionPanelController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user subscription panel data.' })
  @ApiOkResponse({ type: SubscriptionMeDto })
  async getPanel(
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<SubscriptionMeDto> {
    const userId = requireUserId(user);
    return this.subscriptionsService.getSubscriptionPanel(userId);
  }

  @Get('subscription-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user subscription status.' })
  @ApiOkResponse({ type: SubscriptionStatusDto })
  async getStatus(
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<SubscriptionStatusDto> {
    const userId = requireUserId(user);
    return this.subscriptionsService.getSubscriptionStatus(userId);
  }
}
