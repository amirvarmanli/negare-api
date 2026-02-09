import { BadRequestException, Injectable } from '@nestjs/common';
import { DiscountsService, DiscountLineItem, DiscountQuote } from '@app/finance/discounts/discounts.service';
import {
  CheckoutItemRequestDto,
  CheckoutItemResponseDto,
} from './dto/checkout-item.dto';
import { CheckoutPriceQuoteRequestDto } from './dto/price-quote-request.dto';
import { CheckoutPriceQuoteResponseDto } from './dto/price-quote-response.dto';
import { CheckoutConfirmRequestDto } from './dto/confirm-request.dto';
import { CheckoutConfirmResponseDto } from './dto/confirm-response.dto';
import {
  CheckoutDiscountMetadata,
  CheckoutDiscountMetadataDto,
  CheckoutNonAppliedDiscount,
} from './dto/discount-metadata.dto';
import { PaymentsService } from '@app/finance/payments/payments.service';
import { ProductsService } from '@app/finance/products/products.service';
import { SubscriptionsService } from '@app/finance/subscriptions/subscriptions.service';
import { PrismaService } from '@app/prisma/prisma.service';
import { ORDER_PAYMENT_TTL_MINUTES } from '@app/finance/common/finance.constants';
import { DiscountType, OrderKind, OrderStatus, ProductPricingType } from '@app/finance/common/finance.enums';
import { toBigInt } from '@app/finance/common/prisma.utils';
import type { PaymentInitResponseDto } from '@app/finance/payments/dto/payment-init.dto';
import type {
  Prisma,
  FinanceDiscountType,
  FinanceOrder,
  PricingType,
} from '@prisma/client';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly discountsService: DiscountsService,
    private readonly paymentsService: PaymentsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async priceQuote(
    userId: string,
    dto: CheckoutPriceQuoteRequestDto,
  ): Promise<CheckoutPriceQuoteResponseDto> {
    const lineItems = await this.buildLineItems(dto.items);
    const quote = await this.calculateQuote(userId, lineItems, dto.couponCode);
    return this.buildPriceQuoteResponse(lineItems, quote);
  }

  async confirm(
    userId: string,
    dto: CheckoutConfirmRequestDto,
  ): Promise<CheckoutConfirmResponseDto> {
    const requestId = dto.requestId.trim();
    if (!requestId) {
      throw new BadRequestException('requestId is required.');
    }

    const cached = await this.getCachedSession(userId, requestId);
    if (cached) {
      return cached;
    }

    const lineItems = await this.buildLineItems(dto.items);
    let orderResult: { order: FinanceOrder; quote: DiscountQuote; metadata: CheckoutDiscountMetadata };
    try {
      orderResult = await this.createOrder(userId, requestId, dto.couponCode, lineItems);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        return this.buildResponseForExistingOrder(userId, requestId);
      }
      throw error;
    }

    const payment = await this.paymentsService.initOrderPayment(userId, orderResult.order.id);
    const response = this.buildConfirmResponse(orderResult.order, payment, orderResult.metadata);
    return this.ensureSessionStored(
      userId,
      requestId,
      orderResult.order.id,
      payment.paymentId,
      response,
    );
  }

  private async buildLineItems(
    items: CheckoutItemRequestDto[],
  ): Promise<DiscountLineItem[]> {
    const snapshots = await this.productsService.findByIds(
      items.map((item) => item.productId),
    );

    const productMap = new Map(snapshots.map((item) => [item.id, item]));
    const lineItems: DiscountLineItem[] = [];

    for (const item of items) {
      const snapshot = productMap.get(item.productId);
      if (!snapshot) {
        throw new BadRequestException('Product not found.');
      }
      if (
        snapshot.pricingType === ProductPricingType.FREE ||
        snapshot.price === null ||
        snapshot.price <= 0
      ) {
        throw new BadRequestException('Product price is not available for purchase.');
      }

      const unitPrice = Math.round(snapshot.price);
      const lineTotal = unitPrice * item.quantity;

      lineItems.push({
        productId: snapshot.id,
        pricingType: snapshot.pricingType,
        unitPrice,
        quantity: item.quantity,
        lineTotal,
      });
    }

    return lineItems;
  }

  private async calculateQuote(
    userId: string,
    lineItems: DiscountLineItem[],
    couponCode?: string,
  ): Promise<DiscountQuote> {
    return this.prisma.$transaction(async (tx) =>
      this.discountsService.calculateDiscountQuote(tx, {
        userId,
        items: lineItems,
        couponCode: couponCode?.trim() || undefined,
        orderKind: OrderKind.PRODUCT,
        subscriptionDiscount: await this.buildSubscriptionDiscountCandidate(
          userId,
          tx,
        ),
      }),
    );
  }

  private buildPriceQuoteResponse(
    lineItems: DiscountLineItem[],
    quote: DiscountQuote,
  ): CheckoutPriceQuoteResponseDto {
    const metadata = this.buildDiscountMetadata(quote);
    const response = new CheckoutPriceQuoteResponseDto();
    response.items = this.buildItemResponses(lineItems);
    response.subtotal = quote.subtotal;
    response.appliedDiscountPercent = metadata.appliedDiscountPercent;
    response.appliedDiscountAmount = metadata.appliedDiscountAmount;
    response.total = Math.max(0, quote.subtotal - quote.discountValue);
    response.appliedDiscountSource = metadata.appliedDiscountSource;
    response.appliedDiscountCode = metadata.appliedDiscountCode;
    response.appliedDiscountReason = metadata.appliedDiscountReason;
    response.nonAppliedDiscounts = metadata.nonAppliedDiscounts;
    response.discountMetadata = metadata as CheckoutDiscountMetadataDto;
    return response;
  }

  private buildItemResponses(
    lineItems: DiscountLineItem[],
  ): CheckoutItemResponseDto[] {
    return lineItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    }));
  }

  private buildDiscountMetadata(
    quote: DiscountQuote,
  ): CheckoutDiscountMetadataDto {
    const metadata = new CheckoutDiscountMetadataDto();
    metadata.subtotal = quote.subtotal;
    metadata.appliedDiscountSource = quote.appliedDiscountSource;
    metadata.appliedDiscountPercent = quote.appliedDiscountPercent;
    metadata.appliedDiscountAmount = quote.appliedDiscountAmount;
    metadata.appliedDiscountCode = quote.appliedDiscountCode;
    metadata.appliedDiscountReason =
      quote.appliedDiscountReason ?? 'No discount applied.';
    metadata.couponId = quote.discountMetadata.couponId;
    metadata.couponCode = quote.discountMetadata.code;
    metadata.couponValueType = quote.discountMetadata.valueType;
    metadata.couponValue = quote.discountMetadata.value;
    metadata.discountAmount = quote.discountMetadata.discountAmount;
    metadata.discountReason = quote.discountMetadata.reason;
    metadata.subscriptionDiscountPercent = quote.subscriptionDiscountPercent ?? 0;
    metadata.subscriptionDiscountTotal = quote.subscriptionDiscountTotal ?? 0;
    metadata.subscriptionDiscountUsed = quote.subscriptionDiscountUsed ?? 0;
    metadata.subscriptionDiscountRemaining = quote.subscriptionDiscountRemaining ?? 0;
    metadata.subscriptionDiscountQuotaType = quote.subscriptionDiscountQuotaType ?? 'LIFETIME';
    metadata.nonAppliedDiscounts = quote.nonAppliedDiscounts ?? [];
    return metadata;
  }

  private buildConfirmResponse(
    order: FinanceOrder,
    payment: PaymentInitResponseDto,
    metadata: CheckoutDiscountMetadata,
  ): CheckoutConfirmResponseDto {
    const response = new CheckoutConfirmResponseDto();
    response.orderId = order.id;
    response.total = order.total;
    response.appliedDiscountSource = metadata.appliedDiscountSource;
    response.appliedDiscountPercent = metadata.appliedDiscountPercent;
    response.appliedDiscountAmount = metadata.appliedDiscountAmount;
    response.appliedDiscountCode = metadata.appliedDiscountCode;
    response.appliedDiscountReason = metadata.appliedDiscountReason;
    response.nonAppliedDiscounts = metadata.nonAppliedDiscounts;
    response.discountMetadata = metadata as CheckoutDiscountMetadataDto;
    response.payment = payment;
    return response;
  }

  private async createOrder(
    userId: string,
    requestId: string,
    couponCode: string | undefined,
    lineItems: DiscountLineItem[],
  ): Promise<{
    order: FinanceOrder;
    quote: DiscountQuote;
    metadata: CheckoutDiscountMetadata;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const baseQuote = await this.discountsService.calculateDiscountQuote(tx, {
        userId,
        items: lineItems,
        couponCode: couponCode?.trim() || undefined,
        orderKind: OrderKind.PRODUCT,
        subscriptionDiscount: null,
      });

      let quote = { ...baseQuote };
      const subscriptionCandidate = await this.buildSubscriptionDiscountCandidate(
        userId,
        tx,
      );
      if (
        quote.appliedDiscountSource !== 'COUPON' &&
        quote.discountValue <= 0 &&
        subscriptionCandidate
      ) {
        const subscriptionAmount = Math.min(
          Math.floor((quote.subtotal * subscriptionCandidate.percent) / 100),
          quote.subtotal,
        );
        if (subscriptionAmount > 0) {
          quote = {
            ...quote,
            discountType: DiscountType.PERCENT,
            discountValue: subscriptionAmount,
            appliedDiscountSource: 'SUBSCRIPTION',
            appliedDiscountAmount: subscriptionAmount,
            appliedDiscountPercent: subscriptionCandidate.percent,
            appliedDiscountReason: `Subscription discount applied: ${subscriptionCandidate.percent}% off`,
            subscriptionDiscountPercent: subscriptionCandidate.percent,
            subscriptionDiscountRemaining: subscriptionCandidate.remaining,
            subscriptionDiscountUsed: subscriptionCandidate.used,
            subscriptionDiscountTotal: subscriptionCandidate.total,
          };
        }
      }

      const total = Math.max(0, quote.subtotal - quote.discountValue);
      const metadata = this.buildDiscountMetadata(quote);
      const metadataJson = this.toJsonValue(metadata);

      let order = await tx.financeOrder.create({
        data: {
          userId,
          requestId,
          status: OrderStatus.PENDING_PAYMENT as FinanceOrder['status'],
          orderKind: OrderKind.PRODUCT as FinanceOrder['orderKind'],
          subtotal: quote.subtotal,
          discountType: quote.discountType as FinanceDiscountType,
          discountValue: quote.discountValue,
          discountAmount: quote.discountValue,
          discountMetadata: metadataJson,
          discountSource: quote.appliedDiscountSource,
          couponCode: quote.appliedDiscountCode ?? null,
          discountReason: quote.appliedDiscountReason,
          total,
          currency: 'TOMAN',
          subscriptionPlanId: null,
          subscriptionDurationMonths: null,
          paidAt: null,
          expiresAt: new Date(
            Date.now() + ORDER_PAYMENT_TTL_MINUTES * 60 * 1000,
          ),
        },
      });

      const itemsData = lineItems.map((item) => ({
        orderId: order.id,
        productId: toBigInt(item.productId),
        unitPriceSnapshot: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        productTypeSnapshot: item.pricingType as PricingType,
      }));

      await tx.financeOrderItem.createMany({ data: itemsData });

      if (quote.couponId && quote.discountValue > 0) {
        await this.discountsService.commitCouponRedemption(tx, {
          couponId: quote.couponId,
          userId,
          orderId: order.id,
        });
      }

      if (quote.appliedDiscountSource === 'SUBSCRIPTION') {
        const usage = await this.subscriptionsService.consumeSubscriptionDiscountForOrder(
          tx,
          { userId, orderId: order.id, subtotal: quote.subtotal },
        );
        if (!usage) {
          quote = {
            ...quote,
            discountType: DiscountType.NONE,
            discountValue: 0,
            appliedDiscountSource: 'NONE',
            appliedDiscountAmount: 0,
            appliedDiscountPercent: 0,
            appliedDiscountReason: 'No discount applied.',
          };
          const updatedTotal = Math.max(0, quote.subtotal - quote.discountValue);
          const updatedMetadata = this.buildDiscountMetadata(quote);
          const updatedMetadataJson = this.toJsonValue(updatedMetadata);
          order = await tx.financeOrder.update({
            where: { id: order.id },
            data: {
              discountType: 'NONE',
              discountValue: 0,
              discountAmount: 0,
              discountSource: 'NONE',
              discountReason: 'No discount applied.',
              discountMetadata: updatedMetadataJson,
              total: updatedTotal,
            },
          });
        } else {
          quote = {
            ...quote,
            subscriptionDiscountRemaining: usage.remainingAfter,
            subscriptionDiscountUsed: usage.usedAfter,
            subscriptionDiscountTotal: usage.total,
          };
        }
      }

      return { order, quote, metadata: this.buildDiscountMetadata(quote) };
    });
  }

  private async buildSubscriptionDiscountCandidate(
    userId: string,
    tx: Prisma.TransactionClient,
  ): Promise<
    | {
        percent: number;
        remaining: number;
        used: number;
        total: number;
      }
    | null
  > {
    const candidate = await this.subscriptionsService.getDiscountCandidate(
      userId,
      tx,
    );
    if (!candidate) {
      return null;
    }
    return {
      percent: candidate.percent,
      remaining: candidate.remaining,
      used: candidate.used,
      total: candidate.total,
    };
  }

  private async buildResponseForExistingOrder(
    userId: string,
    requestId: string,
  ): Promise<CheckoutConfirmResponseDto> {
    const cached = await this.getCachedSession(userId, requestId);
    if (cached) {
      return cached;
    }

    const order = await this.prisma.financeOrder.findFirst({
      where: { userId, requestId },
    });
    if (!order) {
      throw new BadRequestException('Unable to resolve checkout request.');
    }

    const metadata = this.normalizeMetadata(order.discountMetadata);
    const payment = await this.paymentsService.initOrderPayment(userId, order.id);
    const response = this.buildConfirmResponse(order, payment, metadata);
    return this.ensureSessionStored(userId, requestId, order.id, payment.paymentId, response);
  }

  private async getCachedSession(
    userId: string,
    requestId: string,
  ): Promise<CheckoutConfirmResponseDto | null> {
    const session = await this.prisma.checkoutSession.findUnique({
      where: {
        userId_requestId: {
          userId,
          requestId,
        },
      },
      select: { response: true },
    });
    return (session?.response as unknown as CheckoutConfirmResponseDto) ?? null;
  }

  private async ensureSessionStored(
    userId: string,
    requestId: string,
    orderId: string,
    paymentId: string,
    response: CheckoutConfirmResponseDto,
  ): Promise<CheckoutConfirmResponseDto> {
    const normalized = this.toJsonValue(response);
    try {
      await this.prisma.checkoutSession.create({
        data: {
          userId,
          requestId,
          orderId,
          paymentId,
          response: normalized,
        },
      });
      return response;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const cached = await this.getCachedSession(userId, requestId);
        if (cached) {
          return cached;
        }
      }
      throw error;
    }
  }

  private toJsonValue(value: unknown): Prisma.JsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
  }

  private normalizeMetadata(
    value: Prisma.JsonValue | null,
  ): CheckoutDiscountMetadata {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as unknown as CheckoutDiscountMetadata;
    }
    return {
      subtotal: 0,
      appliedDiscountSource: 'NONE',
      appliedDiscountPercent: 0,
      appliedDiscountAmount: 0,
      appliedDiscountReason: 'No discount applied.',
      couponId: undefined,
      couponCode: undefined,
      couponValueType: undefined,
      couponValue: undefined,
      discountAmount: 0,
      discountReason: 'No discount applied.',
      nonAppliedDiscounts: [],
    };
  }

  private isUniqueConstraintError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      !!error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as Prisma.PrismaClientKnownRequestError).code === 'P2002'
    );
  }
}
