import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { Public } from '@app/common/decorators/public.decorator';
import { requireUserId } from '@app/catalog/utils/current-user.util';
import { PaymentsService } from '@app/finance/payments/payments.service';
import { PaymentInitResponseDto } from '@app/finance/payments/dto/payment-init.dto';
import { PaymentVerifyDto } from '@app/finance/payments/dto/payment-verify.dto';
import { WalletTopupInitDto } from '@app/finance/payments/dto/wallet-topup.dto';
import { OrderResponseDto } from '@app/finance/orders/dto/order-response.dto';
import { PaymentResponseDto } from '@app/finance/payments/dto/payment-response.dto';
import { PaymentResultDto } from '@app/finance/payments/dto/payment-result.dto';
import {
  PaymentListItemDto,
  PaymentListResponseDto,
} from '@app/finance/payments/dto/payment-list.dto';
import { PaymentDetailDto } from '@app/finance/payments/dto/payment-detail.dto';
import { PaymentListQueryDto } from '@app/finance/payments/dto/payment-query.dto';
import {
  PaymentStartDto,
  PaymentStartResponseDto,
} from '@app/finance/payments/dto/payment-start.dto';
import {
  PaymentStatusResponseDto,
  PaymentVerifyRequestDto,
} from '@app/finance/payments/dto/payment-status.dto';
import { ZibalCallbackQueryDto } from '@app/finance/payments/dto/zibal-callback.dto';
import { ZibalHealthResponseDto } from '@app/finance/payments/dto/zibal-health.dto';
import { PaymentStatus } from '@app/finance/common/finance.enums';
import { ConfigService } from '@nestjs/config';
import type { AllConfig } from '@app/config/config.module';
import type { FinanceOrder, FinancePayment } from '@prisma/client';
import type { Request, Response } from 'express';
import { OrderRequestPaymentsService } from '@app/order-requests/order-request-payments.service';
import { PaymentStatus as PhotoRestorePaymentStatus } from '@prisma/client';

@ApiTags('Payments')
@Controller()
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly config: ConfigService<AllConfig>,
    private readonly photoRestorePayments: OrderRequestPaymentsService,
  ) {}

  @Post('payments/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start a gateway payment (subscription or wallet).' })
  @ApiOkResponse({ type: PaymentStartResponseDto })
  async startPayment(
    @Body() dto: PaymentStartDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PaymentStartResponseDto> {
    const userId = requireUserId(user);
    return this.paymentsService.startPayment(userId, dto);
  }

  @Get('payments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List current user payments.' })
  @ApiOkResponse({ type: PaymentListResponseDto })
  async listPayments(
    @Query() query: PaymentListQueryDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PaymentListResponseDto> {
    const userId = requireUserId(user);
    const result = await this.paymentsService.listPaymentsForUser(userId, query);
    return {
      items: result.items.map((payment) => this.toPaymentListItem(payment)),
      meta: result.meta,
    };
  }

  @Get('payments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment details by id.' })
  @ApiOkResponse({ type: PaymentDetailDto })
  async getPaymentById(
    @Param('id') paymentId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PaymentDetailDto> {
    const userId = requireUserId(user);
    const payment = await this.paymentsService.getPaymentForUserById(
      userId,
      paymentId,
    );
    return this.toPaymentDetail(payment);
  }

  @Post('orders/:id/pay/gateway/init')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initialize Zibal gateway payment for an order.' })
  @ApiOkResponse({ type: PaymentInitResponseDto })
  async initOrderGateway(
    @Param('id') orderId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PaymentInitResponseDto> {
    const userId = requireUserId(user);
    return this.paymentsService.initOrderPayment(userId, orderId);
  }

  @Get('orders/:id/payments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List payments for a specific order.' })
  @ApiOkResponse({ type: PaymentListResponseDto })
  async listOrderPayments(
    @Param('id') orderId: string,
    @Query() query: PaymentListQueryDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PaymentListResponseDto> {
    const userId = requireUserId(user);
    const result = await this.paymentsService.listPaymentsForOrder(
      userId,
      orderId,
      query,
    );
    return {
      items: result.items.map((payment) => this.toPaymentListItem(payment)),
      meta: result.meta,
    };
  }

  @Post('payments/gateway/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify gateway payment (mock only).' })
  @ApiOkResponse({ type: PaymentResponseDto })
  async verifyGateway(
    @Body() dto: PaymentVerifyDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PaymentResponseDto> {
    const userId = requireUserId(user);
    const payment = await this.paymentsService.verifyMockPayment(userId, dto);
    return this.toPaymentResponse(payment);
  }

  @Post('wallet/topup/gateway/init')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initialize wallet topup via Zibal gateway.' })
  @ApiOkResponse({ type: PaymentInitResponseDto })
  async initWalletTopup(
    @Body() dto: WalletTopupInitDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PaymentInitResponseDto> {
    const userId = requireUserId(user);
    return this.paymentsService.initWalletTopup(userId, dto.amount);
  }

  @Post('wallet/topup/gateway/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify wallet topup via gateway (mock only).' })
  @ApiOkResponse({ type: PaymentResponseDto })
  async verifyWalletTopup(
    @Body() dto: PaymentVerifyDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PaymentResponseDto> {
    const userId = requireUserId(user);
    const payment = await this.paymentsService.verifyMockPayment(userId, dto);
    return this.toPaymentResponse(payment);
  }

  @Get('payments/zibal/callback')
  @Public()
  @ApiOperation({ summary: 'Handle Zibal callback and verify payment.' })
  @ApiQuery({ name: 'trackId', required: true })
  @ApiOkResponse({ type: PaymentResponseDto })
  async zibalCallback(
    @Query() query: ZibalCallbackQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.handleCallbackWithRedirect(query, req, res);
  }

  @Get('payments/callback')
  @Public()
  @ApiOperation({ summary: 'Handle gateway callback and verify payment.' })
  @ApiQuery({ name: 'trackId', required: true })
  @ApiOkResponse({ type: PaymentResponseDto })
  async paymentCallback(
    @Query() query: ZibalCallbackQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.handleCallbackWithRedirect(query, req, res);
  }

  @Get('payments/zibal/health')
  @Public()
  @ApiOperation({ summary: 'Zibal gateway health check (dev only).' })
  @ApiOkResponse({ type: ZibalHealthResponseDto })
  zibalHealth(): ZibalHealthResponseDto {
    return this.paymentsService.getZibalHealthStatus();
  }

  @Post('orders/:id/pay/wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pay an order using wallet balance.' })
  @ApiOkResponse({ type: OrderResponseDto })
  async payWithWallet(
    @Param('id') orderId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<OrderResponseDto> {
    const userId = requireUserId(user);
    const order = await this.paymentsService.payOrderWithWallet(userId, orderId);
    return this.toOrderResponse(order);
  }

  @Post('orders/:id/pay-with-wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pay an order using wallet balance (new path).' })
  @ApiOkResponse({ type: OrderResponseDto })
  async payWithWalletNew(
    @Param('id') orderId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<OrderResponseDto> {
    const userId = requireUserId(user);
    const order = await this.paymentsService.payOrderWithWallet(userId, orderId);
    return this.toOrderResponse(order);
  }

  @Post('payments/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify payment status.' })
  @ApiOkResponse({ type: PaymentStatusResponseDto })
  async verifyPayment(
    @Body() dto: PaymentVerifyRequestDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PaymentStatusResponseDto> {
    const userId = requireUserId(user);
    const payment = await this.paymentsService.getPaymentStatusForUser(
      userId,
      dto.paymentId,
    );
    return this.toPaymentStatusResponse(payment);
  }

  @Post('payments/:id/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify a gateway payment by id.' })
  @ApiOkResponse({ type: PaymentResponseDto })
  async verifyPaymentById(
    @Param('id') paymentId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PaymentResponseDto> {
    const userId = requireUserId(user);
    const payment = await this.paymentsService.verifyPaymentById(
      userId,
      paymentId,
    );
    return this.toPaymentResponse(payment);
  }

  @Get('payments/:id/result')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment result for UI rendering.' })
  @ApiOkResponse({ type: PaymentResultDto })
  async getPaymentResult(
    @Param('id') paymentId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PaymentResultDto> {
    const userId = requireUserId(user);
    return this.paymentsService.getPaymentResult(userId, paymentId);
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

  private toPaymentResponse(payment: FinancePayment): PaymentResponseDto {
    return {
      id: payment.id,
      provider: payment.provider as PaymentResponseDto['provider'],
      status: payment.status as PaymentResponseDto['status'],
      amount: payment.amount,
      trackId: payment.trackId ?? null,
      authority: payment.authority,
      refId: payment.refId,
    };
  }

  private toPaymentStatusResponse(
    payment: FinancePayment,
  ): PaymentStatusResponseDto {
    return {
      paymentId: payment.id,
      status: payment.status as PaymentStatusResponseDto['status'],
      amount: payment.amount,
      trackId: payment.trackId ?? null,
      refType: (payment.referenceType as PaymentStatusResponseDto['refType']) ?? null,
      refId: payment.referenceId ?? null,
    };
  }

  private toPaymentListItem(payment: FinancePayment): PaymentListItemDto {
    return {
      id: payment.id,
      orderId: payment.orderId ?? null,
      referenceType:
        (payment.referenceType as PaymentListItemDto['referenceType']) ?? null,
      referenceId: payment.referenceId ?? null,
      provider: payment.provider as PaymentListItemDto['provider'],
      status: payment.status as PaymentListItemDto['status'],
      amount: payment.amount,
      currency: 'TOMAN',
      createdAt: payment.createdAt.toISOString(),
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
    };
  }

  private toPaymentDetail(payment: FinancePayment): PaymentDetailDto {
    return {
      id: payment.id,
      orderId: payment.orderId ?? null,
      referenceType:
        (payment.referenceType as PaymentDetailDto['referenceType']) ?? null,
      referenceId: payment.referenceId ?? null,
      provider: payment.provider as PaymentDetailDto['provider'],
      status: payment.status as PaymentDetailDto['status'],
      amount: payment.amount,
      currency: 'TOMAN',
      gatewayReferenceId: payment.refId ?? null,
      failureReason: payment.failureReason ?? null,
      createdAt: payment.createdAt.toISOString(),
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
    };
  }

  private acceptsJson(request: Request): boolean {
    const accept = request.headers.accept ?? '';
    if (Array.isArray(accept)) {
      return accept.some((value) => value.includes('application/json'));
    }
    return accept.includes('application/json') || accept.includes('+json');
  }

  private buildFrontendRedirectUrl(
    status: 'success' | 'failed',
    paymentId: string,
    trackId: string | null | undefined,
    orderId?: string | null,
  ): string {
    const base =
      this.config.get<string>('FRONTEND_BASE_URL') ??
      this.config.get<string>('FRONTEND_URL') ??
      'http://localhost:3000';
    const url = new URL('/payment/result', base);
    url.searchParams.set('status', status);
    url.searchParams.set('paymentId', paymentId);
    if (orderId) {
      url.searchParams.set('orderId', orderId);
    }
    if (trackId) {
      url.searchParams.set('trackId', trackId);
    }
    return url.toString();
  }

  private async handleCallbackWithRedirect(
    query: ZibalCallbackQueryDto,
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const payment = await this.paymentsService.handleZibalCallback(
        query.trackId,
        query.orderId,
      );
      const responseDto = this.toPaymentResponse(payment);
      if (this.acceptsJson(req)) {
        res.status(200).json({ success: true, data: responseDto });
        return;
      }
      const status =
        payment.status === PaymentStatus.SUCCESS ? 'success' : 'failed';
      const redirectUrl = this.buildFrontendRedirectUrl(
        status,
        payment.id,
        payment.trackId ?? query.trackId,
        payment.orderId ?? query.orderId,
      );
      res.redirect(302, redirectUrl);
      return;
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }
    }

    const photoPayment = await this.photoRestorePayments.handleZibalCallback(
      query.trackId,
      req.query as Record<string, unknown>,
    );
    const payload = {
      paymentId: photoPayment.id,
      orderRequestId: photoPayment.orderRequestId,
      status: photoPayment.status,
      trackId: photoPayment.trackId ?? query.trackId,
    };
    if (this.acceptsJson(req)) {
      res.status(200).json({ success: true, data: payload });
      return;
    }
    const status =
      photoPayment.status === PhotoRestorePaymentStatus.SUCCESS
        ? 'success'
        : 'failed';
    const redirectUrl = this.buildPhotoRestoreRedirectUrl(
      status,
      payload.paymentId,
      payload.trackId,
      payload.orderRequestId,
    );
    res.redirect(302, redirectUrl);
  }

  private buildPhotoRestoreRedirectUrl(
    status: 'success' | 'failed',
    paymentId: string,
    trackId: string | null,
    orderRequestId?: string | null,
  ): string {
    const base =
      this.config.get<string>('FRONTEND_BASE_URL') ??
      this.config.get<string>('FRONTEND_URL') ??
      'http://localhost:3000';
    const url = new URL('/special/photo-restore/result', base);
    url.searchParams.set('status', status);
    url.searchParams.set('paymentId', paymentId);
    if (orderRequestId) {
      url.searchParams.set('orderRequestId', orderRequestId);
    }
    if (trackId) {
      url.searchParams.set('trackId', trackId);
    }
    return url.toString();
  }
}
