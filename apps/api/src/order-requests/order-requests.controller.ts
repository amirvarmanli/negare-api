import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '@app/common/decorators/public.decorator';
import { CreateOrderRequestDto } from '@app/order-requests/dto/create-order-request.dto';
import { PaymentIntentResponseDto } from '@app/order-requests/dto/payment-intent-response.dto';
import { OrderRequestsService } from '@app/order-requests/order-requests.service';

@ApiTags('PhotoRestore / Special')
@Controller('special/photo-restore')
export class PhotoRestoreController {
  constructor(private readonly orderRequestsService: OrderRequestsService) {}

  @Post('request-payment')
  @Public()
  @ApiOperation({ summary: 'Create payment intent for photo restore request.' })
  @ApiCreatedResponse({ type: PaymentIntentResponseDto })
  async requestPayment(
    @Body() dto: CreateOrderRequestDto,
  ): Promise<PaymentIntentResponseDto> {
    const result = await this.orderRequestsService.requestPayment(dto);
    const payment = result.payment;
    return {
      paymentId: result.payment.id,
      amountToman: payment.amountToman,
      status: payment.status,
      trackId: payment.trackId,
      redirectUrl: payment.redirectUrl,
    };
  }
}
