import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import {
  CartStatus,
  DonationStatus,
  OrderKind,
  OrderStatus,
  PaymentPurpose,
  PaymentProvider,
  PaymentReferenceType,
  PaymentStatus,
  WalletTransactionReason,
  WalletTransactionStatus,
  WalletTransactionType,
} from '@app/finance/common/finance.enums';
import { ConfigService } from '@nestjs/config';
import {
  buildPaginationMeta,
  type PaginationMeta,
} from '@app/common/dto/pagination.dto';
import {
  PAYMENT_GATEWAY,
  GatewayInitResult,
  PaymentGateway,
} from '@app/finance/payments/gateway/gateway.interface';
import { MockGatewayService } from '@app/finance/payments/gateway/mock-gateway.service';
import { WalletService } from '@app/finance/wallet/wallet.service';
import {
  WALLET_TOPUP_MAX_AMOUNT,
  WALLET_TOPUP_MIN_AMOUNT,
} from '@app/finance/wallet/wallet.constants';
import { EntitlementsService } from '@app/finance/entitlements/entitlements.service';
import { RevenueService } from '@app/finance/revenue/revenue.service';
import { SubscriptionsService } from '@app/finance/subscriptions/subscriptions.service';
import { CartService, type CartSnapshot } from '@app/finance/cart/cart.service';
import { DonationsService } from '@app/finance/donations/donations.service';
import type { PaymentVerifyDto } from '@app/finance/payments/dto/payment-verify.dto';
import type { PaymentInitResponseDto } from '@app/finance/payments/dto/payment-init.dto';
import type { PaymentStartDto, PaymentStartResponseDto } from '@app/finance/payments/dto/payment-start.dto';
import {
  FinanceOrder,
  FinanceDiscountType,
  FinanceDonationStatus,
  FinanceOrderKind,
  FinanceOrderStatus,
  FinancePayment,
  FinancePaymentProvider,
  FinancePaymentReferenceType,
  FinancePaymentStatus,
  FinanceSubscriptionPurchase,
  FinanceSubscriptionPurchaseStatus,
  FinanceWalletStatus,
  PricingType,
  Prisma,
} from '@prisma/client';
import type { AllConfig } from '@app/config/config.module';
import { requestTraceStorage } from '@app/common/tracing/request-trace';
import { toBigInt } from '@app/finance/common/prisma.utils';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  // Platform amounts are TOMAN; Zibal expects IRR (rial).
  private readonly zibalMinAmountToman = 100;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
    private readonly mockGateway: MockGatewayService,
    private readonly config: ConfigService<AllConfig>,
    private readonly walletService: WalletService,
    private readonly entitlementsService: EntitlementsService,
    private readonly revenueService: RevenueService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly cartService: CartService,
    private readonly donationsService: DonationsService,
  ) {}

  async startPayment(
    userId: string,
    dto: PaymentStartDto,
  ): Promise<PaymentStartResponseDto> {
    const refType = dto.refType;
    if (refType === PaymentReferenceType.CART) {
      throw new BadRequestException(
        'Cart payments are no longer supported. Checkout to create an order, then call /orders/:id/pay/gateway/init.',
      );
    }

    if (refType === PaymentReferenceType.SUBSCRIPTION) {
      if (!dto.refId) {
        throw new BadRequestException('refId is required for subscription.');
      }
      const purchase = await this.ensurePendingSubscriptionPurchase(
        userId,
        dto.refId,
      );
      this.ensureZibalAmount(purchase.amount);
      const init = await this.gateway.requestPayment(
        this.toIrrAmount(purchase.amount),
        {
          callbackUrl: this.getZibalCallbackUrl(),
          description: `Subscription ${purchase.id}`,
        },
      );

      const payment = await this.prisma.$transaction(async (tx) => {
        const created = await tx.financePayment.create({
          data: {
            orderId: null,
            userId,
            purpose: PaymentPurpose.ORDER,
            referenceType: refType as FinancePaymentReferenceType,
            referenceId: purchase.id,
            provider: PaymentProvider.ZIBAL as FinancePaymentProvider,
            status: PaymentStatus.PENDING as FinancePaymentStatus,
            amount: purchase.amount,
            currency: 'TOMAN',
            trackId: init.trackId,
            authority: init.trackId,
            refId: null,
            verifiedAt: null,
            paidAt: null,
            meta: { gateway: 'zibal', subscriptionPurchaseId: purchase.id },
          },
        });
        await tx.financeSubscriptionPurchase.update({
          where: { id: purchase.id },
          data: { paymentId: created.id },
        });
        return created;
      });

      return {
        paymentId: payment.id,
        redirectUrl: init.paymentUrl,
        trackId: init.trackId,
      };
    }

    if (refType === PaymentReferenceType.WALLET_CHARGE) {
      if (!dto.amount) {
        throw new BadRequestException('Amount is required for wallet charge.');
      }
      return this.startWalletTopup(userId, dto.amount, dto.refId ?? null);
    }

    if (refType === PaymentReferenceType.DONATION) {
      if (!dto.amount) {
        throw new BadRequestException('Amount is required for donation.');
      }
      // Donations are handled by the dedicated donations flow.
      const donation = await this.donationsService.initDonation(
        userId,
        dto.amount,
      );
      return {
        paymentId: donation.paymentId,
        donationId: donation.donationId,
        redirectUrl: donation.redirectUrl,
        trackId: donation.trackId,
      };
    }

    throw new BadRequestException('Unsupported payment reference type.');
  }

  async startWalletTopup(
    userId: string,
    amount: number,
    referenceId?: string | null,
  ): Promise<PaymentStartResponseDto> {
    const { payment, init } = await this.createWalletTopupPayment(
      userId,
      amount,
      referenceId ?? null,
    );
    return {
      paymentId: payment.id,
      redirectUrl: init.paymentUrl,
      trackId: init.trackId,
    };
  }

  private async createWalletTopupPayment(
    userId: string,
    amount: number,
    referenceId?: string | null,
  ): Promise<{ payment: FinancePayment; init: GatewayInitResult }> {
    if (amount < WALLET_TOPUP_MIN_AMOUNT || amount > WALLET_TOPUP_MAX_AMOUNT) {
      throw new BadRequestException(
        `Amount must be between ${WALLET_TOPUP_MIN_AMOUNT} and ${WALLET_TOPUP_MAX_AMOUNT} TOMAN.`,
      );
    }
    this.ensureZibalAmount(amount);
    const init = await this.gateway.requestPayment(
      this.toIrrAmount(amount),
      {
        callbackUrl: this.getZibalCallbackUrl(),
        description: 'Wallet topup',
      },
    );

    const payment = await this.prisma.$transaction(async (tx) => {
      const wallet = await this.walletService.getOrCreateWalletInTransaction(
        tx,
        userId,
      );

      const created = await tx.financePayment.create({
        data: {
          orderId: null,
          userId,
          purpose: PaymentPurpose.WALLET_TOPUP,
          referenceType: PaymentReferenceType.WALLET_CHARGE as FinancePaymentReferenceType,
          referenceId: referenceId ?? wallet.id,
          provider: PaymentProvider.ZIBAL as FinancePaymentProvider,
          status: PaymentStatus.PENDING as FinancePaymentStatus,
          amount,
          currency: 'TOMAN',
          trackId: init.trackId,
          authority: init.trackId,
          refId: null,
          verifiedAt: null,
          paidAt: null,
          meta: { gateway: 'zibal' },
        },
      });

      await this.walletService.createTransaction(tx, {
        walletId: wallet.id,
        userId,
        type: WalletTransactionType.CREDIT,
        reason: WalletTransactionReason.TOPUP,
        status: WalletTransactionStatus.PENDING,
        amount,
        referenceId: created.id,
        idempotencyKey: `payment:${created.id}`,
        description: 'Wallet topup',
      });

      return created;
    });

    return { payment, init };
  }

  async getPaymentStatusForUser(
    userId: string,
    paymentId: string,
  ): Promise<FinancePayment> {
    const payment = await this.prisma.financePayment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found.');
    }
    if (payment.userId !== userId) {
      throw new ForbiddenException('Access denied.');
    }
    return payment;
  }

  async listPaymentsForUser(
    userId: string,
    params: {
      page?: number;
      limit?: number;
      status?: PaymentStatus;
    },
  ): Promise<{ items: FinancePayment[]; meta: PaginationMeta }> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit =
      params.limit && params.limit > 0 ? Math.min(params.limit, 50) : 20;
    const skip = (page - 1) * limit;
    const where: Prisma.FinancePaymentWhereInput = { userId };
    if (params.status) {
      where.status = params.status as FinancePaymentStatus;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.financePayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.financePayment.count({ where }),
    ]);

    return {
      items,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async listPaymentsForOrder(
    userId: string,
    orderId: string,
    params: {
      page?: number;
      limit?: number;
      status?: PaymentStatus;
    },
  ): Promise<{ items: FinancePayment[]; meta: PaginationMeta }> {
    const order = await this.prisma.financeOrder.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('Access denied.');
    }

    const page = params.page && params.page > 0 ? params.page : 1;
    const limit =
      params.limit && params.limit > 0 ? Math.min(params.limit, 50) : 20;
    const skip = (page - 1) * limit;
    const where: Prisma.FinancePaymentWhereInput = {
      userId,
      orderId,
    };
    if (params.status) {
      where.status = params.status as FinancePaymentStatus;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.financePayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.financePayment.count({ where }),
    ]);

    return {
      items,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getPaymentForUserById(
    userId: string,
    paymentId: string,
  ): Promise<FinancePayment> {
    const payment = await this.prisma.financePayment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found.');
    }
    if (payment.userId !== userId) {
      throw new ForbiddenException('Access denied.');
    }
    return payment;
  }

  async verifyPaymentById(
    userId: string,
    paymentId: string,
  ): Promise<FinancePayment> {
    const payment = await this.getPaymentForUserById(userId, paymentId);
    if ((payment.provider as PaymentProvider) === PaymentProvider.MOCK) {
      throw new BadRequestException(
        'Mock payments must be verified via /payments/gateway/verify.',
      );
    }
    if (!payment.trackId) {
      throw new BadRequestException('Payment trackId is missing.');
    }
    return this.handleZibalCallback(payment.trackId, payment.orderId ?? undefined);
  }

  async getPaymentResult(
    userId: string,
    paymentId: string,
  ): Promise<{
    purpose: PaymentPurpose;
    status: PaymentStatus;
    amountToman: number;
    messageFa: string;
    orderId?: string | null;
    canAccessDownloads?: boolean;
    walletBalanceToman?: number;
    topupAmountToman?: number;
  }> {
    const payment = await this.getPaymentForUserById(userId, paymentId);
    const purpose = payment.purpose as PaymentPurpose;
    const status = payment.status as PaymentStatus;
    const messageFa = this.buildPaymentMessageFa(purpose, status);

    if (purpose === PaymentPurpose.WALLET_TOPUP) {
      const wallet = await this.walletService.getWallet(userId);
      return {
        purpose,
        status,
        amountToman: payment.amount,
        messageFa,
        walletBalanceToman: wallet.balance,
        topupAmountToman: payment.amount,
      };
    }

    let canAccessDownloads = false;
    if (payment.orderId) {
      const order = await this.prisma.financeOrder.findUnique({
        where: { id: payment.orderId },
      });
      canAccessDownloads = (order?.status as OrderStatus) === OrderStatus.PAID;
    }

    return {
      purpose,
      status,
      amountToman: payment.amount,
      messageFa,
      orderId: payment.orderId ?? null,
      canAccessDownloads,
    };
  }

  async payWithWalletForReference(
    userId: string,
    refType: PaymentReferenceType.CART | PaymentReferenceType.SUBSCRIPTION,
    refId: string,
  ): Promise<{ receiptId: string; paidAmount: number; newBalance: number }> {
    const result = await this.prisma.$transaction(async (tx) => {
      if (refType === PaymentReferenceType.CART) {
        const snapshot = await this.cartService.getCartSnapshotInTransaction(
          tx,
          userId,
        );
        if (snapshot.cart.id !== refId) {
          throw new BadRequestException('Cart reference does not match.');
        }
        const order = await this.createPaidOrderFromCartSnapshot(
          tx,
          userId,
          snapshot,
        );
        const debitResult = await this.applyWalletDebit(tx, {
          userId,
          amount: snapshot.total,
          reason: WalletTransactionReason.ORDER_PAYMENT,
          referenceId: order.id,
          idempotencyKey: `order:${order.id}`,
          description: `Cart payment for order ${order.id}`,
        });
        await this.cartService.clearCartInTransaction(
          tx,
          snapshot.cart.id,
          CartStatus.CHECKED_OUT,
        );
        return {
          receiptId: order.id,
          paidAmount: snapshot.total,
          newBalance: debitResult.newBalance,
          orderId: order.id,
        };
      }

      const purchase = await this.ensurePendingSubscriptionPurchase(
        userId,
        refId,
        tx,
      );
      const debitResult = await this.applyWalletDebit(tx, {
        userId,
        amount: purchase.amount,
        reason: WalletTransactionReason.ORDER_PAYMENT,
        referenceId: purchase.id,
        idempotencyKey: `subscription:${purchase.id}`,
        description: `Subscription payment ${purchase.id}`,
      });

      await tx.financeSubscriptionPurchase.update({
        where: { id: purchase.id },
        data: {
          status: FinanceSubscriptionPurchaseStatus.PAID,
          paidAt: new Date(),
        },
      });
      await this.subscriptionsService.activateSubscriptionFromPurchase(
        tx,
        purchase,
      );

      return {
        receiptId: purchase.id,
        paidAmount: purchase.amount,
        newBalance: debitResult.newBalance,
        orderId: null,
      };
    });
    if (result.orderId) {
      await this.ensureOrderRevenueSplits(result.orderId);
    }
    return {
      receiptId: result.receiptId,
      paidAmount: result.paidAmount,
      newBalance: result.newBalance,
    };
  }

  async initOrderPayment(
    userId: string,
    orderId: string,
  ): Promise<PaymentInitResponseDto> {
    const order = await this.prisma.financeOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('Access denied.');
    }
    await this.ensureOrderNotExpired(this.prisma, order);
    if ((order.status as OrderStatus) !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Order is not payable.');
    }

    this.ensureZibalAmount(order.total);
    const callbackUrl = this.getZibalCallbackUrl();
    const init = await this.gateway.requestPayment(
      this.toIrrAmount(order.total),
      {
        callbackUrl,
        description: `Order ${order.id}`,
        orderId: order.id,
        factorNumber: order.id,
      },
    );

    const payment = await this.prisma.financePayment.create({
      data: {
        orderId: order.id,
        userId,
        purpose: PaymentPurpose.ORDER,
        referenceId: order.id,
        provider: PaymentProvider.ZIBAL as FinancePaymentProvider,
        status: PaymentStatus.PENDING as FinancePaymentStatus,
        amount: order.total,
        currency: 'TOMAN',
        trackId: init.trackId,
        authority: init.trackId,
        refId: null,
        verifiedAt: null,
        paidAt: null,
        meta: { gateway: 'zibal' },
      },
    });

    return {
      paymentId: payment.id,
      trackId: init.trackId,
      authority: init.trackId,
      gatewayUrl: init.paymentUrl,
      amount: order.total,
    };
  }

  async initWalletTopup(
    userId: string,
    amount: number,
  ): Promise<PaymentInitResponseDto> {
    const { payment, init } = await this.createWalletTopupPayment(
      userId,
      amount,
    );

    return {
      paymentId: payment.id,
      trackId: init.trackId,
      authority: init.trackId,
      gatewayUrl: init.paymentUrl,
      amount,
    };
  }

  async verifyMockPayment(
    userId: string,
    dto: PaymentVerifyDto,
  ): Promise<FinancePayment> {
    const updatedPayment = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const payment = await tx.financePayment.findUnique({
          where: { id: dto.paymentId },
        });
        if (!payment) {
          throw new NotFoundException('Payment not found.');
        }
        if (payment.userId !== userId) {
          throw new ForbiddenException('Access denied.');
        }

        if (payment.status === PaymentStatus.SUCCESS) {
          return payment;
        }
        if ((payment.status as PaymentStatus) !== PaymentStatus.PENDING) {
          throw new BadRequestException('Payment is not pending.');
        }

        if ((payment.provider as PaymentProvider) !== PaymentProvider.MOCK) {
          throw new BadRequestException(
            'This endpoint only supports mock payments.',
          );
        }

        if (!dto.success) {
          const failedPayment = await tx.financePayment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.FAILED as FinancePaymentStatus,
              failureReason: 'mock_failed',
            },
          });
          await this.markWalletTopupFailed(tx, failedPayment);
          await this.markDonationFailed(tx, failedPayment);
          return failedPayment;
        }

        const trackId = dto.authority ?? payment.authority ?? '';
        const gatewayResult = await this.mockGateway.verifyPayment(trackId);

        const updatedPayment = await tx.financePayment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.SUCCESS as FinancePaymentStatus,
            refId: dto.refId ?? gatewayResult.refId ?? payment.refId,
            verifiedAt: new Date(),
            paidAt: new Date(),
            failureReason: null,
          },
        });

        await this.fulfillPayment(tx, updatedPayment);
        return updatedPayment;
      },
    );
    const refreshed = await this.prisma.financePayment.findUnique({
      where: { id: updatedPayment.id },
    });
    await this.ensureOrderRevenueSplits(
      refreshed?.orderId ?? updatedPayment.orderId,
    );
    return updatedPayment;
  }

  async handleZibalCallback(
    trackId: string,
    orderId?: string,
  ): Promise<FinancePayment> {
    const traceId = requestTraceStorage.getStore()?.traceId ?? 'unknown';
    const payment = await this.prisma.financePayment.findFirst({
      where: { trackId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found.');
    }

    if (orderId && payment.orderId !== orderId) {
      throw new BadRequestException('Payment does not match order.');
    }

    if ((payment.provider as PaymentProvider) !== PaymentProvider.ZIBAL) {
      throw new BadRequestException('Invalid payment provider for callback.');
    }

    const verifyStart = Date.now();
    const gatewayResult = await this.gateway.verifyPayment(trackId);
    const verifyDurationMs = Date.now() - verifyStart;
    this.logger.log(
      `traceId=${traceId} Zibal verify: trackId=${trackId} orderId=${orderId ?? 'n/a'} ok=${gatewayResult.ok} amount=${gatewayResult.amount ?? 'n/a'} refId=${gatewayResult.refId ?? 'n/a'} durationMs=${verifyDurationMs}`,
    );

    if (payment.status === PaymentStatus.SUCCESS) {
      this.logger.log(
        `traceId=${traceId} Zibal callback: trackId=${trackId} orderId=${orderId ?? 'n/a'} status=already_verified`,
      );
      await this.ensureOrderRevenueSplits(payment.orderId);
      return payment;
    }

    const txStart = Date.now();
    const updatedPayment = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        if (!gatewayResult.ok) {
          const baseMeta = this.getMetaObject(payment.meta);
          const updateResult = await tx.financePayment.updateMany({
            where: {
              id: payment.id,
              status: PaymentStatus.PENDING as FinancePaymentStatus,
            },
            data: {
              status: PaymentStatus.FAILED as FinancePaymentStatus,
              failureReason: 'gateway_verification_failed',
              meta: {
                ...baseMeta,
                verify: this.toJsonValue(gatewayResult.raw),
              },
            },
          });
          if (updateResult.count === 0) {
            return tx.financePayment.findUniqueOrThrow({
              where: { id: payment.id },
            });
          }
          const failedPayment = await tx.financePayment.findUniqueOrThrow({
            where: { id: payment.id },
          });
          await this.markWalletTopupFailed(tx, failedPayment);
          await this.markDonationFailed(tx, failedPayment);
          return failedPayment;
        }

        if (
          gatewayResult.amount !== null &&
          gatewayResult.amount !== this.toIrrAmount(payment.amount)
        ) {
          const baseMeta = this.getMetaObject(payment.meta);
          const updateResult = await tx.financePayment.updateMany({
            where: {
              id: payment.id,
              status: PaymentStatus.PENDING as FinancePaymentStatus,
            },
            data: {
              status: PaymentStatus.FAILED as FinancePaymentStatus,
              failureReason: 'amount_mismatch',
              meta: {
                ...baseMeta,
                verify: this.toJsonValue(gatewayResult.raw),
                mismatch: 'amount',
              },
            },
          });
          if (updateResult.count === 0) {
            return tx.financePayment.findUniqueOrThrow({
              where: { id: payment.id },
            });
          }
          const failedPayment = await tx.financePayment.findUniqueOrThrow({
            where: { id: payment.id },
          });
          await this.markWalletTopupFailed(tx, failedPayment);
          await this.markDonationFailed(tx, failedPayment);
          return failedPayment;
        }

        const baseMeta = this.getMetaObject(payment.meta);
        const updateResult = await tx.financePayment.updateMany({
          where: {
            id: payment.id,
            status: PaymentStatus.PENDING as FinancePaymentStatus,
          },
          data: {
            status: PaymentStatus.SUCCESS as FinancePaymentStatus,
            refId: gatewayResult.refId ?? payment.refId,
            verifiedAt: gatewayResult.paidAt ?? new Date(),
            paidAt: gatewayResult.paidAt ?? new Date(),
            failureReason: null,
            meta: {
              ...baseMeta,
              verify: this.toJsonValue(gatewayResult.raw),
            },
          },
        });
        if (updateResult.count === 0) {
          return tx.financePayment.findUniqueOrThrow({
            where: { id: payment.id },
          });
        }

        const updatedPayment = await tx.financePayment.findUniqueOrThrow({
          where: { id: payment.id },
        });

        await this.fulfillPayment(tx, updatedPayment);
        return updatedPayment;
      },
    );
    const txDurationMs = Date.now() - txStart;
    this.logger.log(
      `traceId=${traceId} Zibal tx: trackId=${trackId} durationMs=${txDurationMs}`,
    );

    const refreshed = await this.prisma.financePayment.findUnique({
      where: { id: updatedPayment.id },
    });
    await this.ensureOrderRevenueSplits(
      refreshed?.orderId ?? updatedPayment.orderId ?? payment.orderId,
    );
    return updatedPayment;
  }

  async payOrderWithWallet(
    userId: string,
    orderId: string,
  ): Promise<FinanceOrder> {
    const paidOrder = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
      const order = await tx.financeOrder.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundException('Order not found.');
      }
      if (order.userId !== userId) {
        throw new ForbiddenException('Access denied.');
      }
      await this.ensureOrderNotExpired(tx, order);
      if ((order.status as OrderStatus) === OrderStatus.PAID) {
        return order;
      }
      if ((order.status as OrderStatus) !== OrderStatus.PENDING_PAYMENT) {
        throw new BadRequestException('Order is not payable.');
      }
      const debitResult = await this.applyWalletDebit(tx, {
        userId,
        amount: order.total,
        reason: WalletTransactionReason.ORDER_PAYMENT,
        referenceId: order.id,
        idempotencyKey: `order:${order.id}`,
        description: `Order payment ${order.id}`,
      });
      if (debitResult.alreadyProcessed) {
        const refreshedOrder = await tx.financeOrder.findUniqueOrThrow({
          where: { id: order.id },
        });
        if ((refreshedOrder.status as OrderStatus) === OrderStatus.PAID) {
          return refreshedOrder;
        }
      }

      const paidOrder = await tx.financeOrder.update({
        where: { id: order.id },
        data: { status: OrderStatus.PAID as FinanceOrderStatus, paidAt: new Date() },
      });

      const items = await tx.financeOrderItem.findMany({
        where: { orderId: order.id },
      });

      if ((paidOrder.orderKind as OrderKind) === OrderKind.PRODUCT) {
        await this.entitlementsService.grantPurchaseEntitlements(
          tx,
          paidOrder.userId,
          paidOrder.id,
          items,
          paidOrder.paidAt ?? new Date(),
        );
      }

      if ((paidOrder.orderKind as OrderKind) === OrderKind.SUBSCRIPTION) {
        await this.subscriptionsService.activateSubscriptionFromOrder(
          tx,
          paidOrder,
        );
      }

      return paidOrder;
    },
    );
    await this.ensureOrderRevenueSplits(paidOrder.id);
    return paidOrder;
  }

  private getZibalCallbackUrl(): string {
    const cfg = this.config.get('zibal', { infer: true });
    if (!cfg?.callbackUrl) {
      throw new BadRequestException('Zibal callback URL is not configured.');
    }
    const globalPrefix = this.config.get<string>('GLOBAL_PREFIX') ?? '';
    const expectedPaths = this.buildCallbackPaths(globalPrefix);
    const parsed = this.parseUrl(cfg.callbackUrl, 'Zibal callback URL');
    const callbackPath = this.normalizePath(parsed.pathname);
    if (!expectedPaths.includes(callbackPath)) {
      throw new BadRequestException(
        `Zibal callback URL must be ${expectedPaths.join(' or ')} (current: ${callbackPath}).`,
      );
    }
    return parsed.toString();
  }

  getZibalHealthStatus() {
    if (!this.isDev()) {
      throw new NotFoundException();
    }
    const cfg = this.config.get('zibal', { infer: true });
    const globalPrefix = this.config.get<string>('GLOBAL_PREFIX') ?? '';
    const expectedCallbackPaths = this.buildCallbackPaths(globalPrefix);
    const issues: string[] = [];
    let callbackUrl = '';
    let callbackPath = '';

    if (!cfg?.merchant) {
      issues.push('ZIBAL_MERCHANT is missing.');
    }
    if (!cfg?.baseUrl) {
      issues.push('ZIBAL_BASE_URL is missing.');
    } else if (!cfg.baseUrl.startsWith('https://')) {
      issues.push('ZIBAL_BASE_URL should be HTTPS.');
    }
    if (!cfg?.callbackUrl) {
      issues.push('ZIBAL_CALLBACK_URL is missing.');
    } else {
      const parsed = this.parseUrl(cfg.callbackUrl, 'Zibal callback URL');
      callbackUrl = parsed.toString();
      callbackPath = this.normalizePath(parsed.pathname);
      if (!expectedCallbackPaths.includes(callbackPath)) {
        issues.push(
          `ZIBAL_CALLBACK_URL path should be ${expectedCallbackPaths.join(' or ')} (current: ${callbackPath}).`,
        );
      }
    }

    return {
      ok: issues.length === 0,
      issues,
      baseUrl: cfg?.baseUrl ?? '',
      callbackUrl,
      callbackPath,
      expectedCallbackPaths,
      merchantPresent: Boolean(cfg?.merchant),
      amountUnit: 'TOMAN',
      minAmount: this.zibalMinAmountToman,
    };
  }

  private ensureZibalAmount(amount: number): void {
    if (!Number.isFinite(amount)) {
      throw new BadRequestException('Amount must be a valid number.');
    }
    if (amount < this.zibalMinAmountToman) {
      throw new BadRequestException(
        `Amount must be at least ${this.zibalMinAmountToman} TOMAN.`,
      );
    }
  }

  private buildPaymentMessageFa(
    purpose: PaymentPurpose,
    status: PaymentStatus,
  ): string {
    if (status === PaymentStatus.SUCCESS) {
      return purpose === PaymentPurpose.WALLET_TOPUP
        ? 'شارژ کیف پول با موفقیت انجام شد.'
        : purpose === PaymentPurpose.DONATION
          ? 'پرداخت حمایت با موفقیت انجام شد.'
          : 'پرداخت با موفقیت انجام شد.';
    }
    if (status === PaymentStatus.FAILED) {
      return 'پرداخت ناموفق بود.';
    }
    if (status === PaymentStatus.CANCELED) {
      return 'پرداخت لغو شد.';
    }
    return 'در انتظار تایید پرداخت.';
  }

  private async markDonationSuccess(
    tx: Prisma.TransactionClient,
    payment: FinancePayment,
  ): Promise<void> {
    const donationId = this.getDonationIdFromPayment(payment);
    if (!donationId) {
      return;
    }
    await tx.financeDonation.updateMany({
      where: {
        id: donationId,
        status: DonationStatus.PENDING as FinanceDonationStatus,
      },
      data: {
        status: DonationStatus.SUCCESS as FinanceDonationStatus,
        referenceId: payment.refId ?? null,
      },
    });
  }

  private async markDonationFailed(
    tx: Prisma.TransactionClient,
    payment: FinancePayment,
  ): Promise<void> {
    const donationId = this.getDonationIdFromPayment(payment);
    if (!donationId) {
      return;
    }
    await tx.financeDonation.updateMany({
      where: {
        id: donationId,
        status: DonationStatus.PENDING as FinanceDonationStatus,
      },
      data: {
        status: DonationStatus.FAILED as FinanceDonationStatus,
        referenceId: payment.refId ?? null,
      },
    });
  }

  private getDonationIdFromPayment(payment: FinancePayment): string | null {
    const refType = payment.referenceType as PaymentReferenceType | null;
    const purpose = payment.purpose as PaymentPurpose | null;
    if (
      refType !== PaymentReferenceType.DONATION &&
      purpose !== PaymentPurpose.DONATION
    ) {
      return null;
    }
    if (payment.referenceId) {
      return payment.referenceId;
    }
    const meta = this.getMetaObject(payment.meta);
    const donationId = meta.donationId;
    return typeof donationId === 'string' ? donationId : null;
  }

  private toIrrAmount(amountToman: number): number {
    return amountToman * 10;
  }

  private isDev(): boolean {
    return (process.env.NODE_ENV || 'development').toLowerCase() !== 'production';
  }

  private buildCallbackPaths(globalPrefix: string): string[] {
    const prefix = globalPrefix.trim();
    const base = prefix ? `/${prefix.replace(/^\/+|\/+$/g, '')}` : '';
    return [
      `${base}/payments/callback`,
      `${base}/payments/zibal/callback`,
    ];
  }

  private parseUrl(value: string, label: string): URL {
    try {
      return new URL(value);
    } catch {
      throw new BadRequestException(`${label} must be a valid URL.`);
    }
  }

  private normalizePath(pathname: string): string {
    const trimmed = pathname.replace(/\/+$/, '');
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  private getMetaObject(
    meta: Prisma.JsonValue | null,
  ): Record<string, Prisma.InputJsonValue> {
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      return meta as Record<string, Prisma.InputJsonValue>;
    }
    return {};
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.toJsonValue(item));
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const converted: Record<string, Prisma.InputJsonValue> = {};
      for (const [key, val] of Object.entries(record)) {
        converted[key] = this.toJsonValue(val);
      }
      return converted;
    }
    return String(value);
  }

  private async ensurePendingSubscriptionPurchase(
    userId: string,
    purchaseId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<FinanceSubscriptionPurchase> {
    const purchase = await tx.financeSubscriptionPurchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) {
      throw new NotFoundException('Subscription purchase not found.');
    }
    if (purchase.userId !== userId) {
      throw new ForbiddenException('Access denied.');
    }
    if (
      (purchase.status as FinanceSubscriptionPurchaseStatus) !==
      FinanceSubscriptionPurchaseStatus.PENDING
    ) {
      throw new BadRequestException('Subscription purchase is not pending.');
    }
    return purchase;
  }

  private buildCartMeta(snapshot: CartSnapshot): Prisma.InputJsonValue {
    return {
      cartId: snapshot.cart.id,
      totals: {
        subtotal: snapshot.subtotal,
        discount: snapshot.discountValue,
        total: snapshot.total,
      },
      discountType: snapshot.discountType,
      discountValue: snapshot.discountValue,
      couponId: snapshot.couponId ?? null,
      items: snapshot.lineItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        pricingType: item.pricingType as PricingType,
        title: item.product.title ?? null,
        coverImage: item.product.coverUrl ?? null,
      })),
    };
  }

  private async createPaidOrderFromCartSnapshot(
    tx: Prisma.TransactionClient,
    userId: string,
    snapshot: CartSnapshot,
  ): Promise<FinanceOrder> {
    const order = await tx.financeOrder.create({
      data: {
        userId,
        status: OrderStatus.PAID as FinanceOrderStatus,
        orderKind: OrderKind.PRODUCT as FinanceOrderKind,
        subtotal: snapshot.subtotal,
        discountType: snapshot.discountType,
        discountValue: snapshot.discountValue,
        total: snapshot.total,
        currency: 'TOMAN',
        subscriptionPlanId: null,
        subscriptionDurationMonths: null,
        paidAt: new Date(),
      },
    });

    await tx.financeOrderItem.createMany({
      data: snapshot.lineItems.map((item) => ({
        orderId: order.id,
        productId: toBigInt(item.productId),
        unitPriceSnapshot: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        productTypeSnapshot: item.pricingType as PricingType,
      })),
    });

    if (snapshot.couponId && snapshot.discountValue > 0) {
      await tx.financeCouponRedemption.create({
        data: {
          couponId: snapshot.couponId,
          userId,
          orderId: order.id,
          amount: snapshot.discountValue,
        },
      });
    }

    const items = await tx.financeOrderItem.findMany({
      where: { orderId: order.id },
    });
    await this.entitlementsService.grantPurchaseEntitlements(
      tx,
      userId,
      order.id,
      items,
      order.paidAt ?? new Date(),
    );

    return order;
  }

  private async createPaidOrderFromCartMeta(
    tx: Prisma.TransactionClient,
    userId: string,
    cartMeta: {
      cartId: string;
      totals: { subtotal: number; discount: number; total: number };
      discountType: FinanceDiscountType;
      discountValue: number;
      couponId?: string | null;
      items: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        pricingType: PricingType;
      }>;
    },
  ): Promise<FinanceOrder> {
    const order = await tx.financeOrder.create({
      data: {
        userId,
        status: OrderStatus.PAID as FinanceOrderStatus,
        orderKind: OrderKind.PRODUCT as FinanceOrderKind,
        subtotal: cartMeta.totals.subtotal,
        discountType: cartMeta.discountType,
        discountValue: cartMeta.discountValue,
        total: cartMeta.totals.total,
        currency: 'TOMAN',
        subscriptionPlanId: null,
        subscriptionDurationMonths: null,
        paidAt: new Date(),
      },
    });

    await tx.financeOrderItem.createMany({
      data: cartMeta.items.map((item) => ({
        orderId: order.id,
        productId: toBigInt(item.productId),
        unitPriceSnapshot: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        productTypeSnapshot: item.pricingType,
      })),
    });

    if (cartMeta.couponId && cartMeta.discountValue > 0) {
      await tx.financeCouponRedemption.create({
        data: {
          couponId: cartMeta.couponId,
          userId,
          orderId: order.id,
          amount: cartMeta.discountValue,
        },
      });
    }

    const items = await tx.financeOrderItem.findMany({
      where: { orderId: order.id },
    });
    await this.entitlementsService.grantPurchaseEntitlements(
      tx,
      userId,
      order.id,
      items,
      order.paidAt ?? new Date(),
    );

    return order;
  }

  private async fulfillPayment(
    tx: Prisma.TransactionClient,
    payment: FinancePayment,
  ): Promise<void> {
    const refType = payment.referenceType as PaymentReferenceType | null;
    const purpose = payment.purpose as PaymentPurpose | null;
    if (
      purpose === PaymentPurpose.WALLET_TOPUP ||
      (!purpose && refType === PaymentReferenceType.WALLET_CHARGE)
    ) {
      await this.applyWalletTopup(tx, payment);
      return;
    }

    if (payment.orderId) {
      await this.fulfillOrderPayment(tx, payment);
      return;
    }

    if (refType === PaymentReferenceType.CART) {
      if (payment.orderId) {
        return;
      }
      const meta = this.getMetaObject(payment.meta);
      const cartMeta = meta.cart as
        | {
            cartId: string;
            totals: { subtotal: number; discount: number; total: number };
            discountType: FinanceDiscountType;
            discountValue: number;
            couponId?: string | null;
            items: Array<{
              productId: string;
              quantity: number;
              unitPrice: number;
              lineTotal: number;
              pricingType: PricingType;
              title?: string | null;
              coverImage?: string | null;
            }>;
          }
        | undefined;

      if (!cartMeta) {
        throw new BadRequestException('Cart snapshot is missing.');
      }
      if (payment.referenceId && payment.referenceId !== cartMeta.cartId) {
        throw new BadRequestException('Cart reference does not match.');
      }

      const order = await this.createPaidOrderFromCartMeta(
        tx,
        payment.userId,
        cartMeta,
      );

      await tx.financePayment.update({
        where: { id: payment.id },
        data: { orderId: order.id },
      });

      await this.cartService.clearCartInTransaction(
        tx,
        cartMeta.cartId,
        CartStatus.CHECKED_OUT,
      );
      return;
    }

    if (refType === PaymentReferenceType.SUBSCRIPTION) {
      const meta = this.getMetaObject(payment.meta);
      const purchaseId =
        payment.referenceId ??
        (typeof meta.subscriptionPurchaseId === 'string'
          ? meta.subscriptionPurchaseId
          : null);
      if (!purchaseId) {
        throw new BadRequestException('Subscription reference is missing.');
      }
      const purchase = await tx.financeSubscriptionPurchase.findUnique({
        where: { id: purchaseId },
      });
      if (!purchase) {
        throw new NotFoundException('Subscription purchase not found.');
      }
      if (
        (purchase.status as FinanceSubscriptionPurchaseStatus) ===
        FinanceSubscriptionPurchaseStatus.PAID
      ) {
        return;
      }
      await tx.financeSubscriptionPurchase.update({
        where: { id: purchase.id },
        data: {
          status: FinanceSubscriptionPurchaseStatus.PAID,
          paidAt: new Date(),
          paymentId: payment.id,
        },
      });
      await this.subscriptionsService.activateSubscriptionFromPurchase(
        tx,
        purchase,
      );
    }

    if (
      refType === PaymentReferenceType.DONATION ||
      purpose === PaymentPurpose.DONATION
    ) {
      await this.markDonationSuccess(tx, payment);
    }
  }

  private async applyWalletTopup(
    tx: Prisma.TransactionClient,
    payment: FinancePayment,
  ): Promise<void> {
    const wallet = await this.walletService.getOrCreateWalletInTransaction(
      tx,
      payment.userId,
    );
    const idempotencyKey = `payment:${payment.id}`;
    let walletTx = await tx.financeWalletTransaction.findFirst({
      where: { walletId: wallet.id, idempotencyKey },
    });

    if (!walletTx) {
      walletTx = await this.walletService.createTransaction(tx, {
        walletId: wallet.id,
        userId: payment.userId,
        type: WalletTransactionType.CREDIT,
        reason: WalletTransactionReason.TOPUP,
        status: WalletTransactionStatus.PENDING,
        amount: payment.amount,
        referenceId: payment.id,
        idempotencyKey,
        description: 'Wallet topup',
      });
    }

    if (walletTx.status === WalletTransactionStatus.SUCCESS) {
      return;
    }

    const statusUpdate = await tx.financeWalletTransaction.updateMany({
      where: { id: walletTx.id, status: WalletTransactionStatus.PENDING },
      data: { status: WalletTransactionStatus.SUCCESS },
    });
    if (statusUpdate.count === 0) {
      return;
    }

    const updatedWallet = await tx.financeWallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: payment.amount } },
    });

    await tx.financeWalletTransaction.update({
      where: { id: walletTx.id },
      data: {
        status: WalletTransactionStatus.SUCCESS,
        balanceAfter: updatedWallet.balance,
      },
    });
  }

  private async markWalletTopupFailed(
    tx: Prisma.TransactionClient,
    payment: FinancePayment,
  ): Promise<void> {
    const refType = payment.referenceType as PaymentReferenceType | null;
    const isLegacyWalletCharge = !refType && !payment.orderId;
    if (refType !== PaymentReferenceType.WALLET_CHARGE && !isLegacyWalletCharge) {
      return;
    }
    const wallet = await this.walletService.getOrCreateWalletInTransaction(
      tx,
      payment.userId,
    );
    const idempotencyKey = `payment:${payment.id}`;
    await tx.financeWalletTransaction.updateMany({
      where: { walletId: wallet.id, idempotencyKey, status: WalletTransactionStatus.PENDING },
      data: { status: WalletTransactionStatus.FAILED },
    });
  }

  private async applyWalletDebit(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      amount: number;
      reason: WalletTransactionReason;
      referenceId?: string | null;
      idempotencyKey?: string | null;
      description?: string | null;
    },
  ): Promise<{
    walletId: string;
    newBalance: number;
    transactionId: string;
    alreadyProcessed: boolean;
  }> {
    const wallet = await this.walletService.getOrCreateWalletInTransaction(
      tx,
      input.userId,
    );
    if (wallet.status !== FinanceWalletStatus.ACTIVE) {
      throw new BadRequestException('Wallet is suspended.');
    }

    let transaction: { id: string; status: WalletTransactionStatus } | null = null;
    if (input.idempotencyKey) {
      try {
        const created = await this.walletService.createTransaction(tx, {
          walletId: wallet.id,
          userId: input.userId,
          type: WalletTransactionType.DEBIT,
          reason: input.reason,
          status: WalletTransactionStatus.PENDING,
          amount: input.amount,
          referenceId: input.referenceId ?? null,
          idempotencyKey: input.idempotencyKey,
          description: input.description ?? null,
        });
        transaction = { id: created.id, status: created.status as WalletTransactionStatus };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const existing = await tx.financeWalletTransaction.findFirst({
            where: { walletId: wallet.id, idempotencyKey: input.idempotencyKey },
            select: { id: true, status: true },
          });
          if (!existing) {
            throw error;
          }
          if (existing.status === WalletTransactionStatus.SUCCESS) {
            return {
              walletId: wallet.id,
              newBalance: wallet.balance,
              transactionId: existing.id,
              alreadyProcessed: true,
            };
          }
          throw new BadRequestException('Wallet transaction is already in progress.');
        }
        throw error;
      }
    } else {
      const created = await this.walletService.createTransaction(tx, {
        walletId: wallet.id,
        userId: input.userId,
        type: WalletTransactionType.DEBIT,
        reason: input.reason,
        status: WalletTransactionStatus.PENDING,
        amount: input.amount,
        referenceId: input.referenceId ?? null,
        idempotencyKey: null,
        description: input.description ?? null,
      });
      transaction = { id: created.id, status: created.status as WalletTransactionStatus };
    }

    if (!transaction) {
      throw new BadRequestException('Unable to create wallet transaction.');
    }

    const updated = await tx.financeWallet.updateMany({
      where: {
        id: wallet.id,
        balance: { gte: input.amount },
        status: FinanceWalletStatus.ACTIVE,
      },
      data: { balance: { decrement: input.amount } },
    });
    if (updated.count === 0) {
      await tx.financeWalletTransaction.update({
        where: { id: transaction.id },
        data: { status: WalletTransactionStatus.FAILED },
      });
      throw new BadRequestException('Insufficient wallet balance.');
    }

    const refreshedWallet = await tx.financeWallet.findUniqueOrThrow({
      where: { id: wallet.id },
    });

    await tx.financeWalletTransaction.update({
      where: { id: transaction.id },
      data: {
        status: WalletTransactionStatus.SUCCESS,
        balanceAfter: refreshedWallet.balance,
      },
    });

    return {
      walletId: wallet.id,
      newBalance: refreshedWallet.balance,
      transactionId: transaction.id,
      alreadyProcessed: false,
    };
  }

  private isOrderExpired(order: FinanceOrder): boolean {
    if ((order.status as OrderStatus) === OrderStatus.EXPIRED) {
      return true;
    }
    if (order.expiresAt && order.expiresAt.getTime() < Date.now()) {
      return true;
    }
    return false;
  }

  private async markOrderExpired(
    tx: Prisma.TransactionClient | PrismaService,
    order: FinanceOrder,
  ): Promise<void> {
    if ((order.status as OrderStatus) === OrderStatus.EXPIRED) {
      return;
    }
    await tx.financeOrder.update({
      where: { id: order.id },
      data: { status: OrderStatus.EXPIRED as FinanceOrderStatus },
    });
  }

  private async ensureOrderNotExpired(
    tx: Prisma.TransactionClient | PrismaService,
    order: FinanceOrder,
  ): Promise<void> {
    if ((order.status as OrderStatus) === OrderStatus.PAID) {
      return;
    }
    if (this.isOrderExpired(order)) {
      await this.markOrderExpired(tx, order);
      throw new GoneException('Order has expired.');
    }
  }

  private async fulfillOrderPayment(
    tx: Prisma.TransactionClient,
    payment: FinancePayment,
  ): Promise<void> {
    if (!payment.orderId) {
      return;
    }
    const order = await tx.financeOrder.findUnique({
      where: { id: payment.orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    if (this.isOrderExpired(order) && (order.status as OrderStatus) !== OrderStatus.PAID) {
      await this.markOrderExpired(tx, order);
      const expiredMeta = this.getMetaObject(payment.meta);
      await tx.financePayment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED as FinancePaymentStatus,
          meta: {
            ...expiredMeta,
            failure: 'order_expired',
          },
        },
      });
      return;
    }
    if ((order.status as OrderStatus) !== OrderStatus.PENDING_PAYMENT) {
      return;
    }

    const paidOrder = await tx.financeOrder.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.PAID as FinanceOrderStatus,
        paidAt: new Date(),
      },
    });

    const items = await tx.financeOrderItem.findMany({
      where: { orderId: order.id },
    });

    if ((paidOrder.orderKind as OrderKind) === OrderKind.PRODUCT) {
      await this.entitlementsService.grantPurchaseEntitlements(
        tx,
        paidOrder.userId,
        paidOrder.id,
        items,
        paidOrder.paidAt ?? new Date(),
      );
    }

    if ((paidOrder.orderKind as OrderKind) === OrderKind.SUBSCRIPTION) {
      await this.subscriptionsService.activateSubscriptionFromOrder(
        tx,
        paidOrder,
      );
    }
  }

  private async ensureOrderRevenueSplits(
    orderId: string | null | undefined,
  ): Promise<void> {
    if (!orderId) {
      return;
    }
    const order = await this.prisma.financeOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      return;
    }
    if ((order.orderKind as OrderKind) !== OrderKind.PRODUCT) {
      return;
    }
    if ((order.status as OrderStatus) !== OrderStatus.PAID) {
      return;
    }
    await this.revenueService.recordOrderRevenueSplits(order, order.items);
  }
}
