import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '@app/common/decorators/public.decorator';
import { OrderRequestPaymentsService } from '@app/order-requests/order-request-payments.service';
import {
  PaymentCallbackResponseDto,
  PaymentStatusResponseDto,
  PaymentVerifyRequestDto,
} from '@app/order-requests/dto/payment-response.dto';

@ApiTags('PhotoRestore / Special')
@Controller('special/photo-restore')
export class PhotoRestorePaymentsController {
  constructor(private readonly paymentsService: OrderRequestPaymentsService) {}

  @Get('payments/:id')
  @Public()
  @ApiOperation({ summary: 'Get photo restore payment status by id.' })
  @ApiOkResponse({ type: PaymentStatusResponseDto })
  async getPayment(@Param('id') id: string): Promise<PaymentStatusResponseDto> {
    const result = await this.paymentsService.getPaymentStatus(id);
    const payment = result.payment;
    return {
      id: payment.id,
      paymentId: payment.id,
      orderRequestId: payment.orderRequestId,
      status: payment.status,
      amountToman: payment.amountToman,
      imageCount: result.imageCount,
      fileUrl: result.fileUrl,
      trackId: payment.trackId,
      redirectUrl: payment.redirectUrl,
      createdAt: payment.createdAt.toISOString(),
    };
  }

  @Post('zibal/verify')
  @Public()
  @ApiOperation({ summary: 'Verify photo restore payment by id (dev helper).' })
  @ApiBody({ type: PaymentVerifyRequestDto })
  @ApiOkResponse({ type: PaymentCallbackResponseDto })
  async verifyPayment(
    @Body() dto: PaymentVerifyRequestDto,
  ): Promise<PaymentCallbackResponseDto> {
    const payment = await this.paymentsService.verifyPaymentById(dto.paymentId);
    return {
      paymentId: payment.id,
      orderRequestId: payment.orderRequestId,
      status: payment.status,
    };
  }
}
