import {
  Body,
  Controller,
  Get,
  BadRequestException,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  Req,
  Res,
  Logger,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { Roles } from '@app/common/decorators/roles.decorator';
import { Permissions } from '@app/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@app/common/guards/permissions.guard';
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
import { PaymentResponseDto } from '@app/finance/payments/dto/payment-response.dto';
import {
  PaymentResultDto,
  PaymentResultNextAction,
  PaymentResultIntent,
} from '@app/finance/payments/dto/payment-result.dto';
import { PaymentResultQueryDto } from '@app/finance/payments/dto/payment-result-query.dto';
import {
  DonationWalletPayDto,
  DonationWalletPayResponseDto,
} from '@app/finance/payments/dto/donation-wallet.dto';
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
import {
  PaymentFulfillmentStatus,
  PaymentProvider,
  PaymentReferenceType,
  PaymentSource,
  PaymentStatus,
} from '@app/finance/common/finance.enums';
import { ConfigService } from '@nestjs/config';
import type { AllConfig } from '@app/config/config.module';
import type { FinancePayment } from '@prisma/client';
import type { Request, Response } from 'express';
import { OrderRequestPaymentsService } from '@app/order-requests/order-request-payments.service';
import {
  OrderRequestPaymentFulfillmentStatus,
  PaymentStatus as PhotoRestorePaymentStatus,
} from '@prisma/client';
import { requestTraceStorage } from '@app/common/tracing/request-trace';
import { RoleName } from '@prisma/client';
import { PhotoRestorePaymentStatusDto } from '@app/order-requests/dto/photo-restore-payment-status.dto';
import { isUUID } from 'class-validator';

@ApiTags('Payments')
@Controller()
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

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
  @ApiOperation({
    summary:
      'Verify gateway payment (mock only), settle supplier revenue from gross totals, debit the platform wallet for coupon/campaign discounts once, emit the admin notification, and clear the customer cart.',
  })
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

  @Post('donations/pay-with-wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pay a donation using wallet balance.' })
  @ApiOkResponse({ type: DonationWalletPayResponseDto })
  async payDonationWithWallet(
    @Body() dto: DonationWalletPayDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<DonationWalletPayResponseDto> {
    const userId = requireUserId(user);
    const result = await this.paymentsService.payDonationWithWallet(
      userId,
      dto.amount,
      dto.idempotencyKey,
    );
    return {
      donationId: result.donationId,
      paymentId: result.payment.id,
      status: result.payment.status as DonationWalletPayResponseDto['status'],
      fulfillmentStatus:
        result.payment
          .fulfillmentStatus as DonationWalletPayResponseDto['fulfillmentStatus'],
      newBalance: result.newBalance,
    };
  }

  @Get('payments/zibal/callback')
  @Public()
  @ApiOperation({
    summary:
      'Handle Zibal callback, verify payment, settle supplier revenue from gross totals, debit the platform wallet for platform-funded discounts once, emit the admin notification, and clear the cart when successful.',
  })
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
  @ApiOperation({
    summary:
      'Handle gateway callback, verify payment, settle supplier revenue from gross totals, debit the platform wallet for platform-funded discounts once, emit the admin notification, and clear the cart when successful.',
  })
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
  @ApiOkResponse({ type: PaymentResponseDto })
  @ApiBadRequestResponse({
    description: 'موجودی کیف پول کافی نیست.',
  })
  async payWithWallet(
    @Param('id') orderId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PaymentResponseDto> {
    const userId = requireUserId(user);
    const payment = await this.paymentsService.payOrderWithWallet(
      userId,
      orderId,
    );
    const traceId = requestTraceStorage.getStore()?.traceId ?? 'unknown';
    this.logger.log(
      `checkoutTraceId=${traceId} action=wallet-checkout-response paymentId=${payment.id} orderId=${payment.orderId ?? orderId}`,
    );
    return this.toPaymentResponse(payment);
  }

  @Post('orders/:id/pay-with-wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pay an order using wallet balance (new path).' })
  @ApiOkResponse({ type: PaymentResponseDto })
  @ApiBadRequestResponse({
    description: 'موجودی کیف پول کافی نیست.',
  })
  async payWithWalletNew(
    @Param('id') orderId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PaymentResponseDto> {
    const userId = requireUserId(user);
    const payment = await this.paymentsService.payOrderWithWallet(
      userId,
      orderId,
    );
    const traceId = requestTraceStorage.getStore()?.traceId ?? 'unknown';
    this.logger.log(
      `checkoutTraceId=${traceId} action=wallet-checkout-response paymentId=${payment.id} orderId=${payment.orderId ?? orderId}`,
    );
    return this.toPaymentResponse(payment);
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

  @Post('admin/payments/:id/fulfill')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Roles(RoleName.admin)
  @Permissions('admin.finance:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retry payment fulfillment (admin).' })
  @ApiOkResponse({ type: PaymentResponseDto })
  async retryPaymentFulfillment(
    @Param('id') paymentId: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentsService.retryFulfillment(paymentId);
    return this.toPaymentResponse(payment);
  }

  @Post('admin/photo-restore/payments/:id/fulfill')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Roles(RoleName.admin)
  @Permissions('admin.finance:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retry photo restore payment fulfillment (admin).' })
  @ApiOkResponse({ type: PhotoRestorePaymentStatusDto })
  async retryPhotoRestoreFulfillment(
    @Param('id') paymentId: string,
  ): Promise<PhotoRestorePaymentStatusDto> {
    const payment = await this.photoRestorePayments.retryFulfillment(paymentId);
    return {
      paymentId: payment.id,
      status: payment.status,
      fulfillmentStatus: payment.fulfillmentStatus,
      orderRequestId: payment.orderRequestId ?? null,
      fulfilledAt: payment.fulfilledAt ? payment.fulfilledAt.toISOString() : null,
    };
  }

  @Get('payments/:id/result')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment result for UI rendering (legacy path).' })
  @ApiOkResponse({ type: PaymentResultDto })
  async getPaymentResult(
    @Param('id', new ParseUUIDPipe({ version: '4' })) paymentId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PaymentResultDto> {
    const userId = requireUserId(user);
    return this.paymentsService.getPaymentResult(userId, paymentId);
  }

  @Get('payments/result')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get payment result by paymentId, trackId, or referenceType/referenceId (priority: paymentId → trackId → reference).',
  })
  @ApiQuery({
    name: 'paymentId',
    required: false,
    description:
      'Payment UUID. Highest priority when multiple params are present.',
  })
  @ApiQuery({
    name: 'trackId',
    required: false,
    description: 'Gateway trackId. Used when paymentId is missing.',
  })
  @ApiQuery({
    name: 'referenceType',
    required: false,
    description:
      'Reference type (canonical). Case-insensitive. Alias: refType.',
  })
  @ApiQuery({
    name: 'referenceId',
    required: false,
    description: 'Reference id (canonical). Alias: refId.',
  })
  @ApiQuery({
    name: 'refType',
    required: false,
    description: 'Legacy alias of referenceType.',
  })
  @ApiQuery({
    name: 'refId',
    required: false,
    description: 'Legacy alias of referenceId.',
  })
  @ApiBadRequestResponse({
    description:
      'Provide only one lookup key. Priority applies when multiple params are present.',
  })
  @ApiOkResponse({ type: PaymentResultDto })
  async getPaymentResultByQuery(
    @Query() query: PaymentResultQueryDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PaymentResultDto> {
    const userId = requireUserId(user);
    const paymentId = query.paymentId;
    const trackId = query.trackId;
    const refType = query.referenceType ?? query.refType;
    const refId = query.referenceId ?? query.refId;

    let selectedLookupKey: 'paymentId' | 'trackId' | 'reference' | null = null;
    if (paymentId) {
      selectedLookupKey = 'paymentId';
    } else if (trackId) {
      selectedLookupKey = 'trackId';
    } else if (refType || refId) {
      selectedLookupKey = 'reference';
    }

    if (!selectedLookupKey) {
      throw new BadRequestException(
        'Provide paymentId, trackId, or refType/refId.',
      );
    }

    const traceId = requestTraceStorage.getStore()?.traceId;
    this.logger.debug(
      JSON.stringify({
        msg: 'payment result lookup',
        traceId,
        selectedLookupKey,
      }),
    );

    const resolvedPaymentId = paymentId ?? '';
    const resolvedTrackId = trackId ?? '';
    const resolvedRefId = refId ?? '';
    const resolvedRefType = refType;

    if (selectedLookupKey === 'paymentId') {
      if (!isUUID(resolvedPaymentId)) {
        throw new BadRequestException('Invalid paymentId.');
      }
    }

    if (selectedLookupKey === 'trackId') {
      if (!resolvedTrackId) {
        throw new BadRequestException('Invalid trackId.');
      }
    }

    if (selectedLookupKey === 'reference') {
      const validRefType = Object.values(PaymentReferenceType).includes(
        resolvedRefType as PaymentReferenceType,
      );
      if (!validRefType || !resolvedRefId) {
        throw new BadRequestException('Invalid referenceType/referenceId.');
      }
    }

    let payment: FinancePayment | null = null;
    try {
      if (selectedLookupKey === 'paymentId') {
        payment = await this.paymentsService.getPaymentById(
          userId,
          resolvedPaymentId,
        );
      } else if (selectedLookupKey === 'trackId') {
        payment = await this.paymentsService.getPaymentByTrackId(
          userId,
          resolvedTrackId,
        );
      } else {
        payment = await this.paymentsService.getPaymentByReference(
          userId,
          resolvedRefType as PaymentReferenceType,
          resolvedRefId,
        );
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        payment = null;
      } else {
        throw error;
      }
    }

    if (payment) {
      return this.paymentsService.getPaymentResultFromPayment(userId, payment);
    }

    const photoPayment =
      selectedLookupKey === 'paymentId'
        ? await this.photoRestorePayments.getPaymentById(resolvedPaymentId)
        : selectedLookupKey === 'trackId'
          ? await this.photoRestorePayments.getPaymentByTrackId(resolvedTrackId)
          : null;

    if (!photoPayment) {
      throw new NotFoundException('Payment not found.');
    }

    const normalizedStatus =
      photoPayment.status === PhotoRestorePaymentStatus.CANCELED
        ? PaymentStatus.FAILED
        : (photoPayment.status as PaymentStatus);
    const fulfillmentStatus =
      photoPayment.fulfillmentStatus ??
      OrderRequestPaymentFulfillmentStatus.PENDING;
    const retryable =
      normalizedStatus === PaymentStatus.SUCCESS &&
      fulfillmentStatus === OrderRequestPaymentFulfillmentStatus.FAILED;
    let recommendedNextAction: PaymentResultNextAction;
    if (normalizedStatus === PaymentStatus.PENDING) {
      recommendedNextAction = PaymentResultNextAction.WAIT;
    } else if (normalizedStatus === PaymentStatus.FAILED) {
      recommendedNextAction = PaymentResultNextAction.RETRY;
    } else if (
      fulfillmentStatus === OrderRequestPaymentFulfillmentStatus.PENDING
    ) {
      recommendedNextAction = PaymentResultNextAction.WAIT;
    } else if (
      fulfillmentStatus === OrderRequestPaymentFulfillmentStatus.FAILED
    ) {
      recommendedNextAction = retryable
        ? PaymentResultNextAction.RETRY
        : PaymentResultNextAction.CONTACT_SUPPORT;
    } else {
      recommendedNextAction = PaymentResultNextAction.GO_TO_PHOTO_RESTORE;
    }

    return {
      paymentId: photoPayment.id,
      status: normalizedStatus,
      source: PaymentSource.GATEWAY,
      provider: PaymentProvider.ZIBAL,
      amount: photoPayment.amountToman,
      currency: 'TOMAN',
      purpose: 'PHOTO_RESTORE',
      referenceType: 'photo_restore',
      referenceId: photoPayment.orderRequestId ?? photoPayment.id,
      intent: PaymentResultIntent.PHOTO_RESTORE,
      fulfillmentStatus:
        fulfillmentStatus === OrderRequestPaymentFulfillmentStatus.SUCCESS
          ? PaymentFulfillmentStatus.SUCCESS
          : fulfillmentStatus === OrderRequestPaymentFulfillmentStatus.FAILED
            ? PaymentFulfillmentStatus.FAILED
            : PaymentFulfillmentStatus.PENDING,
      fulfilledAt: photoPayment.fulfilledAt
        ? photoPayment.fulfilledAt.toISOString()
        : null,
      verifiedAt: null,
      paidAt: null,
      failureReason: photoPayment.message ?? null,
      fulfillmentError: photoPayment.fulfillmentError ?? null,
      retryable,
      recommendedNextAction,
      messageFa: undefined,
      orderId: photoPayment.orderRequestId ?? null,
      canAccessDownloads:
        photoPayment.fulfillmentStatus ===
        OrderRequestPaymentFulfillmentStatus.SUCCESS,
    };
  }

  @Get('payments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment details by id.' })
  @ApiOkResponse({ type: PaymentDetailDto })
  async getPaymentById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) paymentId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PaymentDetailDto> {
    const userId = requireUserId(user);
    const payment = await this.paymentsService.getPaymentForUserById(
      userId,
      paymentId,
    );
    return this.toPaymentDetail(payment);
  }

  private toPaymentResponse(payment: FinancePayment): PaymentResponseDto {
    return {
      id: payment.id,
      provider: payment.provider as PaymentResponseDto['provider'],
      status: payment.status as PaymentResponseDto['status'],
      fulfillmentStatus:
        payment.fulfillmentStatus as PaymentResponseDto['fulfillmentStatus'],
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
      fulfillmentStatus:
        payment.fulfillmentStatus as PaymentDetailDto['fulfillmentStatus'],
      fulfillmentError: payment.fulfillmentError ?? null,
      amount: payment.amount,
      currency: 'TOMAN',
      gatewayReferenceId: payment.refId ?? null,
      failureReason: payment.failureReason ?? null,
      createdAt: payment.createdAt.toISOString(),
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
      fulfilledAt: payment.fulfilledAt ? payment.fulfilledAt.toISOString() : null,
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
      fulfillmentStatus: photoPayment.fulfillmentStatus,
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
