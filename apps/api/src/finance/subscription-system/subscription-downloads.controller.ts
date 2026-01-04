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
import { SubscriptionDownloadsService } from '@app/finance/subscription-system/subscription-downloads.service';
import { SubscriptionDownloadRequestDto } from '@app/finance/subscription-system/dto/subscription-download-request.dto';
import { SubscriptionDownloadDecisionDto } from '@app/finance/subscription-system/dto/subscription-download-decision.dto';

@ApiTags('Finance / Subscription Downloads')
@Controller('subscriptions/downloads')
export class SubscriptionDownloadsController {
  constructor(
    private readonly downloadsService: SubscriptionDownloadsService,
  ) {}

  @Post('validate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate and log a subscription download.' })
  @ApiOkResponse({ type: SubscriptionDownloadDecisionDto })
  async validate(
    @Body() dto: SubscriptionDownloadRequestDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<SubscriptionDownloadDecisionDto> {
    const userId = requireUserId(user);
    return this.downloadsService.validateDownload(userId, dto.productId);
  }
}
