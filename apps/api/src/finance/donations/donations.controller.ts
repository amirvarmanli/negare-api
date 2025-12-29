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
import { DonationsService } from '@app/finance/donations/donations.service';
import { DonationInitDto } from '@app/finance/donations/dto/donation-init.dto';
import { DonationInitResponseDto } from '@app/finance/donations/dto/donation-init-response.dto';
import { DonationResultDto } from '@app/finance/donations/dto/donation-result.dto';

@ApiTags('Finance / Donations')
@ApiBearerAuth()
@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Post('init')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Initialize a donation payment.' })
  @ApiOkResponse({ type: DonationInitResponseDto })
  async initDonation(
    @Body() dto: DonationInitDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<DonationInitResponseDto> {
    const userId = requireUserId(user);
    return this.donationsService.initDonation(userId, dto.amount);
  }

  @Get(':id/result')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get donation payment result.' })
  @ApiOkResponse({ type: DonationResultDto })
  async getDonationResult(
    @Param('id') donationId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<DonationResultDto> {
    const userId = requireUserId(user);
    return this.donationsService.getDonationResult(userId, donationId);
  }
}
