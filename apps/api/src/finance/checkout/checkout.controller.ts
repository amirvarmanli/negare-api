import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { requireUserId } from '@app/catalog/utils/current-user.util';
import { CheckoutService } from './checkout.service';
import { CheckoutPriceQuoteRequestDto } from './dto/price-quote-request.dto';
import { CheckoutPriceQuoteResponseDto } from './dto/price-quote-response.dto';
import { CheckoutConfirmRequestDto } from './dto/confirm-request.dto';
import { CheckoutConfirmResponseDto } from './dto/confirm-response.dto';

@ApiTags('Checkout')
@Controller('checkout')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('price-quote')
  @ApiOperation({ summary: 'Get price quote for cart items with discounts.' })
  @ApiOkResponse({ type: CheckoutPriceQuoteResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  async priceQuote(
    @Body() dto: CheckoutPriceQuoteRequestDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<CheckoutPriceQuoteResponseDto> {
    const userId = requireUserId(user);
    return this.checkoutService.priceQuote(userId, dto);
  }

  @Post('confirm')
  @ApiOperation({
    summary:
      'Create or reuse a checkout order, persist coupon/campaign discount metadata, initialize the payment intent, and cache the response (idempotent requestId) so fulfillment can settle platform-funded coupons without changing supplier payouts.',
  })
  @ApiCreatedResponse({ type: CheckoutConfirmResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  async confirm(
    @Body() dto: CheckoutConfirmRequestDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<CheckoutConfirmResponseDto> {
    const userId = requireUserId(user);
    return this.checkoutService.confirm(userId, dto);
  }
}
