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
  PaymentFulfillmentStatus,
  PaymentReferenceType,
  PaymentSource,
  PaymentStatus,
  RevenueBeneficiaryType,
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
import { ProductsService } from '@app/finance/products/products.service';
import { NotificationsService } from '@app/notifications/notifications.service';
import {
  DONATION_MAX_AMOUNT,
  DONATION_MIN_AMOUNT,
} from '@app/finance/donations/donations.constants';
import type { PaymentVerifyDto } from '@app/finance/payments/dto/payment-verify.dto';
import type { PaymentInitResponseDto } from '@app/finance/payments/dto/payment-init.dto';
import type { PaymentStartDto, PaymentStartResponseDto } from '@app/finance/payments/dto/payment-start.dto';
import {
  FinanceOrder,
  FinanceOrderItem,
  FinanceDiscountType,
  FinanceDonationStatus,
  FinanceOrderKind,
  FinanceOrderStatus,
  FinancePayment,
  FinancePaymentProvider,
  FinancePaymentPurpose,
  FinancePaymentReferenceType,
  FinancePaymentStatus,
  FinancePaymentFulfillmentStatus,
  FinanceSubscriptionPurchase,
  FinanceSubscriptionPurchaseStatus,
  FinanceWalletStatus,
  PricingType,
  NotificationType,
  Prisma,
} from '@prisma/client';
import type { AllConfig } from '@app/config/config.module';
import { requestTraceStorage } from '@app/common/tracing/request-trace';
import { toBigInt } from '@app/finance/common/prisma.utils';
import {
  PaymentResultIntent,
  PaymentResultNextAction,
} from '@app/finance/payments/dto/payment-result.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  // Platform amounts are TOMAN; Zibal expects IRR (rial).
  private readonly zibalMinAmountToman = 100;
  private readonly productSaleDescription = 'فروش محصول';

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
    private readonly mockGateway: MockGatewayService,
    private readonly config: ConfigService<AllConfig>,
    private readonly walletService: WalletService,
    private readonly entitlementsService: EntitlementsService,
    private readonly revenueService: RevenueService,
    private readonly productsService: ProductsService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly cartService: CartService,
    private readonly donationsService: DonationsService,
    private readonly notificationsService: NotificationsService,
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
  ): Promise<import('@app/finance/payments/dto/payment-result.dto').PaymentResultDto> {
    const payment = await this.getPaymentById(userId, paymentId);
    return this.buildPaymentResult(userId, payment);
  }

  async getPaymentById(userId: string, paymentId: string): Promise<FinancePayment> {
    return this.getPaymentForUserById(userId, paymentId);
  }

  async getPaymentByTrackId(
    userId: string,
    trackId: string,
  ): Promise<FinancePayment> {
    const payment = await this.prisma.financePayment.findUnique({
      where: { trackId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found.');
    }
    if (payment.userId !== userId) {
      throw new ForbiddenException('Access denied.');
    }
    return payment;
  }

  async getPaymentByReference(
    userId: string,
    referenceType: PaymentReferenceType,
    referenceId: string,
  ): Promise<FinancePayment> {
    const payment = await this.prisma.financePayment.findFirst({
      where: {
        userId,
        referenceType: referenceType as FinancePaymentReferenceType,
        referenceId,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found.');
    }
    return payment;
  }

  async getPaymentResultFromPayment(
    userId: string,
    payment: FinancePayment,
  ): Promise<import('@app/finance/payments/dto/payment-result.dto').PaymentResultDto> {
    return this.buildPaymentResult(userId, payment);
  }

  async payWithWalletForReference(
    userId: string,
    refType: PaymentReferenceType.CART | PaymentReferenceType.SUBSCRIPTION,
    refId: string,
  ): Promise<{ receiptId: string; paidAmount: number; newBalance: number }> {
    const result = await this.prisma.$transaction(
      async (tx) => {
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
          const items = await tx.financeOrderItem.findMany({
            where: { orderId: order.id },
          });
          await this.applyOrderRevenueSplitAndCredits(tx, order, items);
          await this.applySubscriptionDiscountUsage(tx, order.id);
          await this.cartService.clearCartInTransaction(
            tx,
            snapshot.cart.id,
            CartStatus.CHECKED_OUT,
          );
          const now = new Date();
          await tx.financePayment.create({
            data: {
              orderId: order.id,
              userId,
              purpose: PaymentPurpose.ORDER as FinancePaymentPurpose,
              referenceType: PaymentReferenceType.CART as FinancePaymentReferenceType,
              referenceId: order.id,
              provider: PaymentProvider.MOCK as FinancePaymentProvider,
              status: PaymentStatus.SUCCESS as FinancePaymentStatus,
              fulfillmentStatus:
                PaymentFulfillmentStatus.SUCCESS as FinancePaymentFulfillmentStatus,
              fulfillmentError: null,
              amount: snapshot.total,
              currency: 'TOMAN',
              trackId: null,
              authority: null,
              refId: null,
              verifiedAt: now,
              paidAt: now,
              fulfilledAt: now,
              meta: {
                method: 'WALLET',
                walletTransactionId: debitResult.transactionId,
              },
            },
          });
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
        const now = new Date();
        const payment = await tx.financePayment.create({
          data: {
            orderId: null,
            userId,
            purpose: PaymentPurpose.ORDER as FinancePaymentPurpose,
            referenceType:
              PaymentReferenceType.SUBSCRIPTION as FinancePaymentReferenceType,
            referenceId: purchase.id,
            provider: PaymentProvider.MOCK as FinancePaymentProvider,
            status: PaymentStatus.SUCCESS as FinancePaymentStatus,
            amount: purchase.amount,
            currency: 'TOMAN',
            trackId: null,
            authority: null,
            refId: null,
            verifiedAt: now,
            paidAt: now,
            meta: {
              method: 'WALLET',
              walletTransactionId: debitResult.transactionId,
              subscriptionPurchaseId: purchase.id,
            },
          },
        });
        await this.fulfillPaymentSafely(tx, payment);

        return {
          receiptId: purchase.id,
          paidAmount: purchase.amount,
          newBalance: debitResult.newBalance,
          orderId: null,
        };
      },
      { timeout: 20000 },
    );
    if (result.orderId) {
      await this.notifyOrderEvents(result.orderId);
    }
    return {
      receiptId: result.receiptId,
      paidAmount: result.paidAmount,
      newBalance: result.newBalance,
    };
  }

  async payDonationWithWallet(
    userId: string,
    amount: number,
    idempotencyKey: string,
  ): Promise<{
    donationId: string;
    payment: FinancePayment;
    newBalance: number;
  }> {
    if (!Number.isFinite(amount)) {
      throw new BadRequestException('Amount must be a valid number.');
    }
    if (amount < DONATION_MIN_AMOUNT || amount > DONATION_MAX_AMOUNT) {
      throw new BadRequestException(
        `Amount must be between ${DONATION_MIN_AMOUNT} and ${DONATION_MAX_AMOUNT} TOMAN.`,
      );
    }
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) {
      throw new BadRequestException('idempotencyKey is required.');
    }
    const walletKey = `donation:${normalizedKey}`;

    return this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const wallet = await this.walletService.getOrCreateWalletInTransaction(
          tx,
          userId,
        );
        const existingTx = await tx.financeWalletTransaction.findFirst({
          where: { walletId: wallet.id, idempotencyKey: walletKey },
        });
        if (existingTx) {
          if (existingTx.status === WalletTransactionStatus.SUCCESS) {
            if (!existingTx.referenceId) {
              throw new BadRequestException(
                'Donation payment already processed but reference is missing.',
              );
            }
            const existingPayment = await tx.financePayment.findUnique({
              where: { id: existingTx.referenceId },
            });
            if (!existingPayment) {
              throw new NotFoundException('Payment not found.');
            }
            if (!existingPayment.referenceId) {
              throw new BadRequestException(
                'Donation payment reference is missing.',
              );
            }
            return {
              donationId: existingPayment.referenceId,
              payment: existingPayment,
              newBalance: wallet.balance,
            };
          }
          throw new BadRequestException('Donation payment is already in progress.');
        }

        const donation = await tx.financeDonation.create({
          data: {
            userId,
            amount,
            status: DonationStatus.PENDING as FinanceDonationStatus,
            gatewayTrackId: null,
            referenceId: null,
          },
        });

        const payment = await tx.financePayment.create({
          data: {
            orderId: null,
            userId,
            purpose: PaymentPurpose.DONATION as FinancePaymentPurpose,
            referenceType:
              PaymentReferenceType.DONATION as FinancePaymentReferenceType,
            referenceId: donation.id,
            provider: PaymentProvider.MOCK as FinancePaymentProvider,
            status: PaymentStatus.SUCCESS as FinancePaymentStatus,
            amount,
            currency: 'TOMAN',
            trackId: null,
            authority: null,
            refId: null,
            verifiedAt: new Date(),
            paidAt: new Date(),
            meta: { method: 'WALLET', donationId: donation.id },
          },
        });

        const debitResult = await this.applyWalletDebit(tx, {
          userId,
          amount,
          reason: WalletTransactionReason.DONATION,
          referenceId: payment.id,
          idempotencyKey: walletKey,
          description: 'Donation payment',
        });

        await this.fulfillPaymentSafely(tx, payment);

        const refreshed = await tx.financePayment.findUniqueOrThrow({
          where: { id: payment.id },
        });

        return {
          donationId: donation.id,
          payment: refreshed,
          newBalance: debitResult.newBalance,
        };
      },
      { timeout: 20000 },
    );
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
        referenceType: PaymentReferenceType.CART as FinancePaymentReferenceType,
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

        await this.fulfillPaymentSafely(tx, updatedPayment);
        return updatedPayment;
      },
      { timeout: 20000 },
    );
    const refreshed = await this.prisma.financePayment.findUnique({
      where: { id: updatedPayment.id },
    });
    await this.notifyOrderEvents(refreshed?.orderId ?? updatedPayment.orderId);
    return refreshed ?? updatedPayment;
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
      if (
        (payment.fulfillmentStatus as PaymentFulfillmentStatus | null) !==
        PaymentFulfillmentStatus.SUCCESS
      ) {
        const retried = await this.prisma.$transaction(
          async (tx: Prisma.TransactionClient) => {
            const refreshed = await tx.financePayment.findUniqueOrThrow({
              where: { id: payment.id },
            });
            await this.fulfillPaymentSafely(tx, refreshed);
            return tx.financePayment.findUniqueOrThrow({
              where: { id: payment.id },
            });
          },
          { timeout: 20000 },
        );
        await this.notifyOrderEvents(retried.orderId ?? payment.orderId);
        await this.notifyWalletCreditFromPayment(retried);
        return retried;
      }
      await this.notifyOrderEvents(payment.orderId);
      await this.notifyWalletCreditFromPayment(payment);
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

        await this.fulfillPaymentSafely(tx, updatedPayment);
        return updatedPayment;
      },
      { timeout: 20000 },
    );
    const txDurationMs = Date.now() - txStart;
    this.logger.log(
      `traceId=${traceId} Zibal tx: trackId=${trackId} durationMs=${txDurationMs}`,
    );

    const refreshed = await this.prisma.financePayment.findUnique({
      where: { id: updatedPayment.id },
    });
    await this.notifyOrderEvents(
      refreshed?.orderId ?? updatedPayment.orderId ?? payment.orderId,
    );
    await this.notifyWalletCreditFromPayment(refreshed ?? updatedPayment);
    return refreshed ?? updatedPayment;
  }

  async retryFulfillment(paymentId: string): Promise<FinancePayment> {
    const payment = await this.prisma.financePayment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found.');
    }
    if ((payment.status as PaymentStatus) !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('Payment is not successful yet.');
    }

    const retried = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const refreshed = await tx.financePayment.findUniqueOrThrow({
          where: { id: paymentId },
        });
        await this.fulfillPaymentSafely(tx, refreshed);
        return tx.financePayment.findUniqueOrThrow({
          where: { id: paymentId },
        });
      },
      { timeout: 20000 },
    );

    await this.notifyOrderEvents(retried.orderId ?? payment.orderId);
    await this.notifyWalletCreditFromPayment(retried);
    return retried;
  }

  async payOrderWithWallet(
    userId: string,
    orderId: string,
  ): Promise<FinancePayment> {
    const traceId = requestTraceStorage.getStore()?.traceId ?? 'unknown';
    const context = `checkoutTraceId=${traceId} userId=${userId} orderId=${orderId}`;
    this.logger.log(`${context} action=wallet-checkout-start`);

    try {
      const result = await this.prisma.$transaction(
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
          this.logger.log(
            `${context} action=order-resolved status=${order.status} total=${order.total}`,
          );
          await this.ensureOrderNotExpired(tx, order);
          if ((order.status as OrderStatus) === OrderStatus.PAID) {
            const existingPayment = await tx.financePayment.findFirst({
              where: {
                orderId: order.id,
                status: PaymentStatus.SUCCESS as FinancePaymentStatus,
              },
              orderBy: { createdAt: 'desc' },
            });
            if (existingPayment) {
              const normalized = await this.ensurePaymentReference(
                tx,
                existingPayment,
              );
              this.logger.log(
                `${context} action=wallet-checkout-skip reason=already-paid paymentId=${normalized.id}`,
              );
              return { order, payment: normalized };
            }
          }
          if ((order.status as OrderStatus) !== OrderStatus.PENDING_PAYMENT) {
            throw new BadRequestException('Order is not payable.');
          }

          this.logger.log(
            `${context} action=wallet-debit-attempt amount=${order.total}`,
          );
          const debitResult = await this.applyWalletDebit(tx, {
            userId,
            amount: order.total,
            reason: WalletTransactionReason.ORDER_PAYMENT,
            referenceId: order.id,
            idempotencyKey: `order:${order.id}`,
            description: `Order payment ${order.id}`,
          });
          this.logger.log(
            `${context} action=wallet-debit-success walletTxId=${debitResult.transactionId} newBalance=${debitResult.newBalance} alreadyProcessed=${debitResult.alreadyProcessed}`,
          );

          const now = new Date();
          const payment = await tx.financePayment.create({
            data: {
              orderId: order.id,
              userId,
              purpose: PaymentPurpose.ORDER as FinancePaymentPurpose,
              referenceType: PaymentReferenceType.CART as FinancePaymentReferenceType,
              referenceId: order.id,
              provider: PaymentProvider.MOCK as FinancePaymentProvider,
              status: PaymentStatus.SUCCESS as FinancePaymentStatus,
              amount: order.total,
              currency: 'TOMAN',
              trackId: null,
              authority: null,
              refId: null,
              verifiedAt: now,
              paidAt: now,
              meta: {
                method: 'WALLET',
                walletTransactionId: debitResult.transactionId,
                checkoutTraceId: traceId,
              },
            },
          });
          this.logger.log(
            `${context} action=payment-created paymentId=${payment.id}`,
          );

          this.logger.log(
            `${context} action=fulfillment-start paymentId=${payment.id}`,
          );
          await this.fulfillPaymentSafely(tx, payment);
          this.logger.log(
            `${context} action=fulfillment-complete paymentId=${payment.id}`,
          );

          return { order, payment };
        },
        { timeout: 20000 },
      );

      this.logger.log(
        `${context} action=wallet-checkout-committed paymentId=${result.payment.id}`,
      );
      await this.notifyOrderEvents(result.payment.orderId ?? orderId);
      const refreshed = await this.prisma.financePayment.findUnique({
        where: { id: result.payment.id },
      });
      return refreshed ?? result.payment;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      this.logger.error(
        `${context} action=wallet-checkout-rolled-back error=${message}`,
      );
      throw error;
    }
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

  private getRevenueSplitConfig(): {
    platformPercent: number;
    supplierPercent: number;
    platformUserId: string;
  } {
    const platformPercent =
      this.config.get<number>('PLATFORM_COMMISSION_PERCENT') ?? 30;
    const supplierPercent =
      this.config.get<number>('SUPPLIER_REVENUE_PERCENT') ?? 70;
    const platformUserId = this.config.get<string>('PLATFORM_WALLET_USER_ID');

    if (!platformUserId) {
      throw new BadRequestException('PLATFORM_WALLET_USER_ID is not configured.');
    }
    if (!Number.isInteger(platformPercent) || !Number.isInteger(supplierPercent)) {
      throw new BadRequestException('Revenue split percents must be integers.');
    }
    if (platformPercent + supplierPercent !== 100) {
      throw new BadRequestException(
        'Revenue split percents must sum to 100.',
      );
    }

    return { platformPercent, supplierPercent, platformUserId };
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

  private normalizePaymentStatus(status: PaymentStatus): PaymentStatus {
    if (status === PaymentStatus.CANCELED) {
      return PaymentStatus.FAILED;
    }
    return status;
  }

  private resolvePaymentSource(payment: FinancePayment): PaymentSource {
    const meta = this.getMetaObject(payment.meta);
    if (meta.method === 'WALLET') {
      return PaymentSource.WALLET;
    }
    if ((payment.provider as PaymentProvider) === PaymentProvider.MOCK) {
      return PaymentSource.GATEWAY;
    }
    return PaymentSource.GATEWAY;
  }

  private resolvePaymentIntent(
    purpose: PaymentPurpose,
    referenceType: PaymentReferenceType,
  ): PaymentResultIntent {
    if (purpose === PaymentPurpose.DONATION) {
      return PaymentResultIntent.DONATION;
    }
    if (referenceType === PaymentReferenceType.DONATION) {
      return PaymentResultIntent.DONATION;
    }
    if (referenceType === PaymentReferenceType.SUBSCRIPTION) {
      return PaymentResultIntent.SUBSCRIPTION;
    }
    return PaymentResultIntent.PRODUCT;
  }

  private resolveNextAction(
    intent: PaymentResultIntent,
    status: PaymentStatus,
    fulfillmentStatus: PaymentFulfillmentStatus,
    retryable: boolean,
  ): PaymentResultNextAction {
    if (status === PaymentStatus.PENDING) {
      return PaymentResultNextAction.WAIT;
    }
    if (status === PaymentStatus.FAILED) {
      return PaymentResultNextAction.RETRY;
    }
    if (fulfillmentStatus === PaymentFulfillmentStatus.PENDING) {
      return PaymentResultNextAction.WAIT;
    }
    if (fulfillmentStatus === PaymentFulfillmentStatus.FAILED) {
      return retryable
        ? PaymentResultNextAction.RETRY
        : PaymentResultNextAction.CONTACT_SUPPORT;
    }
    if (intent === PaymentResultIntent.SUBSCRIPTION) {
      return PaymentResultNextAction.GO_TO_SUBSCRIPTION;
    }
    if (intent === PaymentResultIntent.PHOTO_RESTORE) {
      return PaymentResultNextAction.GO_TO_PHOTO_RESTORE;
    }
    if (intent === PaymentResultIntent.DONATION) {
      return PaymentResultNextAction.CONTACT_SUPPORT;
    }
    return PaymentResultNextAction.GO_TO_ORDER;
  }

  private async ensurePaymentReference(
    tx: Prisma.TransactionClient | PrismaService,
    payment: FinancePayment,
  ): Promise<FinancePayment> {
    const refType = payment.referenceType as PaymentReferenceType | null;
    const refId = payment.referenceId;
    if (refType && refId) {
      return payment;
    }
    if (payment.orderId) {
      return tx.financePayment.update({
        where: { id: payment.id },
        data: {
          referenceType:
            PaymentReferenceType.CART as FinancePaymentReferenceType,
          referenceId: payment.orderId,
        },
      });
    }
    throw new BadRequestException(
      'Payment referenceType/referenceId is required.',
    );
  }

  private async buildPaymentResult(
    userId: string,
    paymentInput: FinancePayment,
  ): Promise<import('@app/finance/payments/dto/payment-result.dto').PaymentResultDto> {
    const payment = await this.ensurePaymentReference(this.prisma, paymentInput);
    const purpose = payment.purpose as PaymentPurpose;
    const normalizedStatus = this.normalizePaymentStatus(
      payment.status as PaymentStatus,
    );
    const fulfillmentStatus =
      (payment.fulfillmentStatus as PaymentFulfillmentStatus | null) ??
      PaymentFulfillmentStatus.PENDING;
    const source = this.resolvePaymentSource(payment);
    const referenceType =
      (payment.referenceType as PaymentReferenceType) ??
      PaymentReferenceType.CART;
    const referenceId = payment.referenceId;
    if (!referenceId) {
      throw new BadRequestException(
        'Payment referenceType/referenceId is required.',
      );
    }
    const intent = this.resolvePaymentIntent(purpose, referenceType);
    const retryable =
      normalizedStatus === PaymentStatus.SUCCESS &&
      fulfillmentStatus === PaymentFulfillmentStatus.FAILED;

    let messageFa = this.buildPaymentMessageFa(purpose, normalizedStatus);
    if (
      normalizedStatus === PaymentStatus.SUCCESS &&
      fulfillmentStatus !== PaymentFulfillmentStatus.SUCCESS
    ) {
      messageFa = 'پرداخت با موفقیت انجام شد اما تکمیل سفارش در حال بررسی است.';
    }

    let orderId: string | null = payment.orderId ?? null;
    let canAccessDownloads = false;
    if (orderId) {
      const order = await this.prisma.financeOrder.findUnique({
        where: { id: orderId },
      });
      canAccessDownloads = (order?.status as OrderStatus) === OrderStatus.PAID;
    }

    const result: import('@app/finance/payments/dto/payment-result.dto').PaymentResultDto =
      {
        paymentId: payment.id,
        status: normalizedStatus,
        source,
        provider: payment.provider as PaymentProvider,
        amount: payment.amount,
        currency: payment.currency,
        purpose,
        referenceType,
        referenceId,
        intent,
        fulfillmentStatus,
        fulfilledAt: payment.fulfilledAt
          ? payment.fulfilledAt.toISOString()
          : null,
        verifiedAt: payment.verifiedAt
          ? payment.verifiedAt.toISOString()
          : null,
        paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
        failureReason: payment.failureReason ?? null,
        fulfillmentError: payment.fulfillmentError ?? null,
        retryable,
        recommendedNextAction: this.resolveNextAction(
          intent,
          normalizedStatus,
          fulfillmentStatus,
          retryable,
        ),
        messageFa,
        orderId,
        canAccessDownloads,
      };

    if (purpose === PaymentPurpose.WALLET_TOPUP) {
      const wallet = await this.walletService.getWallet(userId);
      result.walletBalanceToman = wallet.balance;
      result.topupAmountToman = payment.amount;
    }

    return result;
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
        discountAmount: snapshot.discountValue,
        discountSource: snapshot.discountSource,
        couponCode: snapshot.couponCode ?? null,
        discountReason: snapshot.discountReason,
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
      await tx.discountCouponRedemption.create({
        data: {
          couponId: snapshot.couponId,
          userId,
          orderId: order.id,
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
    await this.applyOrderRevenueSplitAndCredits(tx, order, items);
    await this.applySubscriptionDiscountUsage(tx, order.id);

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
    const discountSource =
      cartMeta.couponId && cartMeta.discountValue > 0 ? 'COUPON' : 'NONE';
    const discountReason = cartMeta.couponId
      ? 'Coupon applied'
      : 'No discount applied';
    const order = await tx.financeOrder.create({
      data: {
        userId,
        status: OrderStatus.PAID as FinanceOrderStatus,
        orderKind: OrderKind.PRODUCT as FinanceOrderKind,
        subtotal: cartMeta.totals.subtotal,
        discountType: cartMeta.discountType,
        discountValue: cartMeta.discountValue,
        discountAmount: cartMeta.discountValue,
        discountSource,
        couponCode: null,
        discountReason,
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
      await tx.discountCouponRedemption.create({
        data: {
          couponId: cartMeta.couponId,
          userId,
          orderId: order.id,
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
    await this.applySubscriptionDiscountUsage(tx, order.id);

    return order;
  }

  private async fulfillPaymentSafely(
    tx: Prisma.TransactionClient,
    payment: FinancePayment,
  ): Promise<void> {
    if (
      (payment.fulfillmentStatus as PaymentFulfillmentStatus | null) ===
      PaymentFulfillmentStatus.SUCCESS
    ) {
      return;
    }
    if ((payment.status as PaymentStatus) !== PaymentStatus.SUCCESS) {
      return;
    }

    try {
      await this.fulfillPayment(tx, payment);
      await tx.financePayment.update({
        where: { id: payment.id },
        data: {
          fulfillmentStatus:
            PaymentFulfillmentStatus.SUCCESS as FinancePaymentFulfillmentStatus,
          fulfillmentError: null,
          fulfilledAt: new Date(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await tx.financePayment.update({
        where: { id: payment.id },
        data: {
          fulfillmentStatus:
            PaymentFulfillmentStatus.FAILED as FinancePaymentFulfillmentStatus,
          fulfillmentError: message,
        },
      });
      const traceId = requestTraceStorage.getStore()?.traceId ?? 'unknown';
      this.logger.error(
        `traceId=${traceId} payment-fulfillment-failed paymentId=${payment.id} purpose=${payment.purpose ?? 'n/a'} refType=${payment.referenceType ?? 'n/a'} error=${message}`,
      );
    }
  }

  private async fulfillPayment(
    tx: Prisma.TransactionClient,
    payment: FinancePayment,
  ): Promise<void> {
    const normalizedPayment = await this.ensurePaymentReference(tx, payment);
    if (
      (normalizedPayment.fulfillmentStatus as PaymentFulfillmentStatus | null) ===
      PaymentFulfillmentStatus.SUCCESS
    ) {
      return;
    }
    const refType =
      normalizedPayment.referenceType as PaymentReferenceType | null;
    const purpose = normalizedPayment.purpose as PaymentPurpose | null;
    if (
      purpose === PaymentPurpose.WALLET_TOPUP ||
      (!purpose && refType === PaymentReferenceType.WALLET_CHARGE)
    ) {
      await this.applyWalletTopup(tx, normalizedPayment);
      return;
    }

    if (normalizedPayment.orderId) {
      await this.fulfillOrderPayment(tx, normalizedPayment);
      return;
    }

    if (refType === PaymentReferenceType.CART) {
      if (normalizedPayment.orderId) {
        return;
      }
      const meta = this.getMetaObject(normalizedPayment.meta);
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
      if (
        normalizedPayment.referenceId &&
        normalizedPayment.referenceId !== cartMeta.cartId
      ) {
        throw new BadRequestException('Cart reference does not match.');
      }

      const order = await this.createPaidOrderFromCartMeta(
        tx,
        normalizedPayment.userId,
        cartMeta,
      );

      await tx.financePayment.update({
        where: { id: normalizedPayment.id },
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
      const meta = this.getMetaObject(normalizedPayment.meta);
      const purchaseId =
        normalizedPayment.referenceId ??
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
        (purchase.status as FinanceSubscriptionPurchaseStatus) !==
        FinanceSubscriptionPurchaseStatus.PAID
      ) {
        await tx.financeSubscriptionPurchase.update({
          where: { id: purchase.id },
          data: {
            status: FinanceSubscriptionPurchaseStatus.PAID,
            paidAt: new Date(),
            paymentId: normalizedPayment.id,
          },
        });
      }
      await this.subscriptionsService.activateSubscriptionFromPurchase(
        tx,
        purchase,
      );
    }

    if (
      refType === PaymentReferenceType.DONATION ||
      purpose === PaymentPurpose.DONATION
    ) {
      await this.markDonationSuccess(tx, normalizedPayment);
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
    allowNegative = false,
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

    const walletFilter: Prisma.FinanceWalletWhereInput = {
      id: wallet.id,
      status: FinanceWalletStatus.ACTIVE,
    };
    if (!allowNegative) {
      walletFilter.balance = { gte: input.amount };
    }
    const updated = await tx.financeWallet.updateMany({
      where: walletFilter,
      data: { balance: { decrement: input.amount } },
    });
    if (updated.count === 0) {
      await tx.financeWalletTransaction.update({
        where: { id: transaction.id },
        data: { status: WalletTransactionStatus.FAILED },
      });
      throw new BadRequestException('موجودی کیف پول کافی نیست.');
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

  private async applyWalletCredit(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      amount: number;
      reason: WalletTransactionReason;
      referenceId?: string | null;
      idempotencyKey: string;
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
    try {
      const created = await this.walletService.createTransaction(tx, {
        walletId: wallet.id,
        userId: input.userId,
        type: WalletTransactionType.CREDIT,
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

    if (!transaction) {
      throw new BadRequestException('Unable to create wallet transaction.');
    }

    const statusUpdate = await tx.financeWalletTransaction.updateMany({
      where: { id: transaction.id, status: WalletTransactionStatus.PENDING },
      data: { status: WalletTransactionStatus.SUCCESS },
    });
    if (statusUpdate.count === 0) {
      return {
        walletId: wallet.id,
        newBalance: wallet.balance,
        transactionId: transaction.id,
        alreadyProcessed: true,
      };
    }

    const updatedWallet = await tx.financeWallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: input.amount } },
    });

    await tx.financeWalletTransaction.update({
      where: { id: transaction.id },
      data: {
        status: WalletTransactionStatus.SUCCESS,
        balanceAfter: updatedWallet.balance,
      },
    });

    return {
      walletId: wallet.id,
      newBalance: updatedWallet.balance,
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

  private async markOrderFailedIfPending(
    tx: Prisma.TransactionClient,
    orderId: string,
    context: string,
    failureReason: string,
  ): Promise<void> {
    const result = await tx.financeOrder.updateMany({
      where: {
        id: orderId,
        status: OrderStatus.PENDING_PAYMENT as FinanceOrderStatus,
      },
      data: { status: OrderStatus.FAILED as FinanceOrderStatus },
    });
    if (result.count === 0) {
      return;
    }
    this.logger.log(`${context} action=order-marked-failed reason=${failureReason}`);
    const pendingPayments = await tx.financePayment.findMany({
      where: {
        orderId,
        status: PaymentStatus.PENDING as FinancePaymentStatus,
      },
    });
    for (const payment of pendingPayments) {
      await tx.financePayment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED as FinancePaymentStatus,
          meta: {
            ...this.getMetaObject(payment.meta),
            failure: failureReason,
          },
        },
      });
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

    const traceId = requestTraceStorage.getStore()?.traceId ?? 'unknown';
    const context = `traceId=${traceId} checkoutTraceId=${traceId} userId=${order.userId} orderId=${order.id} paymentId=${payment.id}`;

    if (
      this.isOrderExpired(order) &&
      (order.status as OrderStatus) !== OrderStatus.PAID
    ) {
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
    const currentStatus = order.status as OrderStatus;
    if (
      currentStatus !== OrderStatus.PENDING_PAYMENT &&
      currentStatus !== OrderStatus.PAID
    ) {
      this.logger.log(`${context} action=fulfill-order-skipped status=${order.status}`);
      return;
    }

    this.logger.log(`${context} action=fulfill-order-start`);

    let paidOrder = order;
    if (currentStatus === OrderStatus.PENDING_PAYMENT) {
      paidOrder = await tx.financeOrder.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAID as FinanceOrderStatus,
          paidAt: new Date(),
        },
      });
    } else if (!order.paidAt) {
      paidOrder = await tx.financeOrder.update({
        where: { id: order.id },
        data: { paidAt: new Date() },
      });
    }

    this.logger.log(
      `${context} action=mark-paid-complete paidAt=${paidOrder.paidAt?.toISOString() ?? 'n/a'}`,
    );

    const items = await tx.financeOrderItem.findMany({
      where: { orderId: order.id },
    });

    const grossAmount = items.reduce((total, item) => total + item.lineTotal, 0);
    const discountAmount =
      paidOrder.discountAmount ?? paidOrder.discountValue ?? 0;
    const discountSource = paidOrder.discountSource ?? 'NONE';
    const payableAmount = paidOrder.total;
    const { supplierPercent } = this.getRevenueSplitConfig();
    const supplierShareGross = Math.floor(
      (grossAmount * supplierPercent) / 100,
    );
    const platformShareGross = grossAmount - supplierShareGross;
    this.logger.log(
      `${context} revenue gross=${grossAmount} supplierShare=${supplierShareGross} platformShare=${platformShareGross} discountAmount=${discountAmount} payable=${payableAmount} source=${discountSource}`,
    );

    if ((paidOrder.orderKind as OrderKind) === OrderKind.PRODUCT) {
      await this.entitlementsService.grantPurchaseEntitlements(
        tx,
        paidOrder.userId,
        paidOrder.id,
        items,
        paidOrder.paidAt ?? new Date(),
      );
      const uniqueProducts = new Set(
        items.map((item) => item.productId.toString()),
      ).size;
      this.logger.log(
        `${context} action=entitlements-granted lineItems=${items.length} uniqueProducts=${uniqueProducts}`,
      );
      await this.applyOrderRevenueSplitAndCredits(tx, paidOrder, items);
      await this.applySubscriptionDiscountUsage(tx, paidOrder.id);
    }

    if ((paidOrder.orderKind as OrderKind) === OrderKind.SUBSCRIPTION) {
      await this.subscriptionsService.activateSubscriptionFromOrder(
        tx,
        paidOrder,
      );
    }

    await this.settlePlatformDiscount(
      tx,
      paidOrder,
      payment,
      items,
      context,
      grossAmount,
      payableAmount ?? 0,
      discountAmount,
      discountSource,
    );

    await this.clearUserCart(tx, paidOrder, context);
  }

  private async settlePlatformDiscount(
    tx: Prisma.TransactionClient,
    order: FinanceOrder,
    payment: FinancePayment,
    items: FinanceOrderItem[],
    context: string,
    grossAmount: number,
    payableAmount: number,
    discountAmount: number,
    discountSource: string,
  ): Promise<void> {
    if (discountAmount <= 0 || !this.isPlatformFundedDiscount(discountSource)) {
      return;
    }
    const { platformUserId } = this.getRevenueSplitConfig();
    const allowNegative = this.platformWalletAllowsNegative();
    const traceId = requestTraceStorage.getStore()?.traceId ?? 'unknown';
    try {
      const debitResult = await this.applyWalletDebit(
        tx,
        {
          userId: platformUserId,
          amount: discountAmount,
          reason: WalletTransactionReason.PLATFORM_DISCOUNT,
          referenceId: order.id,
          idempotencyKey: `order:${order.id}:platform-discount`,
          description: 'Coupon discount funded by platform',
        },
        allowNegative,
      );
      if (debitResult.alreadyProcessed) {
        this.logger.log(
          `${context} action=platform-discount-skipped alreadyProcessed=true traceId=${traceId}`,
        );
        return;
      }
      const buyer = await tx.user.findUnique({
        where: { id: order.userId },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          username: true,
          email: true,
          phone: true,
        },
      });
      await this.emitPlatformDiscountNotification({
        tx,
        context,
        traceId,
        order,
        payment,
        items,
        discountAmount,
        discountSource,
        couponCode: order.couponCode,
        grossAmount,
        payableAmount,
        user: buyer,
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        await this.markOrderFailedIfPending(
          tx,
          order.id,
          context,
          'platform_wallet_insufficient',
        );
      }
      throw error;
    }
  }

  private async emitPlatformDiscountNotification(params: {
    tx: Prisma.TransactionClient;
    context: string;
    traceId: string;
    order: FinanceOrder;
    payment: FinancePayment;
    items: FinanceOrderItem[];
    discountAmount: number;
    discountSource: string;
    couponCode: string | null;
    grossAmount: number;
    payableAmount: number;
    user:
      | {
          id: string;
          name: string | null;
          firstName: string | null;
          lastName: string | null;
          username: string | null;
          email: string | null;
          phone: string | null;
        }
      | null;
  }): Promise<void> {
    const {
      tx,
      context,
      traceId,
      order,
      payment,
      items,
      discountAmount,
      couponCode,
      grossAmount,
      payableAmount,
      user,
    } = params;
    const timestamp = new Date().toISOString();
    const grossValue = grossAmount ?? 0;
    const payableValue = payableAmount ?? 0;
    const discountLabel = discountAmount.toLocaleString('fa-IR');
    const grossLabel = grossValue.toLocaleString('fa-IR');
    const payableLabel = payableValue.toLocaleString('fa-IR');
    const couponLabel = couponCode ?? 'بدون کد';
    const userIdentifier = this.buildPlatformDiscountUserIdentifier(user);
    const links = {
      order: `/admin/orders/${order.id}`,
      user: `/admin/users/${order.userId}`,
      products: await this.buildPlatformDiscountProductLinks(tx, items),
    };
    const body = [
      `مبلغ ${discountLabel} تومان بابت اعمال کد تخفیف «${couponLabel}» از کیف پول سایت کسر شد.`,
      '',
      `🔹 سفارش: #${order.id}`,
      `🔹 کاربر: ${userIdentifier}`,
      '',
      `💰 مبلغ قبل از تخفیف: ${grossLabel} تومان`,
      `💳 مبلغ پرداختی کاربر: ${payableLabel} تومان`,
      '',
      'این تخفیف توسط پلتفرم تأمین شده و سهم تأمین‌کننده بدون تغییر تسویه شده است.',
    ].join('\n');
    await this.notificationsService.createNotification({
      type: NotificationType.PLATFORM_DISCOUNT_APPLIED,
      title: 'کسر از کیف پول سایت بابت کد تخفیف',
      body,
      data: {
        type: 'PLATFORM_DISCOUNT_APPLIED',
        traceId,
        timestamp,
        orderId: order.id,
        paymentId: payment.id,
        userId: order.userId,
        couponCode: couponCode ?? null,
        discountAmount,
        grossAmount: grossValue,
        payableAmount: payableValue,
        userContact: userIdentifier,
        links,
      },
    });
    this.logger.log(
      `${context} action=platform-discount-notified type=PLATFORM_DISCOUNT_APPLIED traceId=${traceId} amount=${discountAmount}`,
    );
  }

  private async clearUserCart(
    tx: Prisma.TransactionClient,
    order: FinanceOrder,
    context: string,
  ): Promise<void> {
    const cart = await tx.financeCart.findFirst({
      where: { userId: order.userId },
    });
    if (!cart) {
      this.logger.log(
        `${context} action=cart-cleared itemsCleared=0 reason=cart-not-found`,
      );
      return;
    }
    const itemsCount = await tx.financeCartItem.count({
      where: { cartId: cart.id },
    });
    await this.cartService.clearCartInTransaction(
      tx,
      cart.id,
      CartStatus.CHECKED_OUT,
    );
    this.logger.log(`${context} action=cart-cleared itemsCleared=${itemsCount}`);
  }

  private buildPlatformDiscountUserIdentifier(
    user:
      | {
          id: string;
          phone: string | null;
          email: string | null;
        }
      | null,
  ): string {
    if (!user) {
      return 'unknown';
    }
    const contact = user.phone ?? user.email ?? null;
    return `${user.id}${contact ? ` (${contact})` : ''}`;
  }

  private async buildPlatformDiscountProductLinks(
    tx: Prisma.TransactionClient,
    items: FinanceOrderItem[],
  ): Promise<
    Array<{ productId: string; title: string; url: string }>
  > {
    const productIds = Array.from(
      new Set(items.map((item) => item.productId.toString())),
    );
    if (productIds.length === 0) {
      return [];
    }
    const products = await tx.product.findMany({
      where: { id: { in: productIds.map((id) => toBigInt(id)) } },
      select: { id: true, title: true, slug: true },
    });
    const productMap = new Map(
      products.map((product) => [
        product.id.toString(),
        { title: product.title, slug: product.slug },
      ]),
    );
    return productIds.map((productId) => {
      const record = productMap.get(productId);
      const title = record?.title ?? 'محصول';
      const slug = record?.slug;
      const url = slug ? `/products/${slug}` : `/products/${productId}`;
      return { productId, title, url };
    });
  }

  private isPlatformFundedDiscount(
    source: string | null | undefined,
  ): boolean {
    const normalized = (source ?? '').toUpperCase();
    return normalized === 'COUPON' || normalized === 'CAMPAIGN';
  }

  private platformWalletAllowsNegative(): boolean {
    return this.config.get<boolean>('PLATFORM_WALLET_ALLOW_NEGATIVE') ?? false;
  }

  private async applyOrderRevenueSplitAndCredits(
    tx: Prisma.TransactionClient,
    order: FinanceOrder,
    items: FinanceOrderItem[],
  ): Promise<void> {
    if ((order.orderKind as OrderKind) !== OrderKind.PRODUCT) {
      return;
    }
    if ((order.status as OrderStatus) !== OrderStatus.PAID) {
      return;
    }

    const { platformUserId } = this.getRevenueSplitConfig();
    const platformUser = await tx.user.findUnique({
      where: { id: platformUserId },
      select: { id: true },
    });
    if (!platformUser) {
      throw new BadRequestException('PLATFORM_WALLET_USER_ID was not found.');
    }

    const splits = await this.revenueService.recordOrderRevenueSplits(
      order,
      items,
      tx,
      platformUserId,
    );

    for (const split of splits) {
      if (split.amount <= 0) {
        continue;
      }
      const productId = split.productId.toString();
      if (split.beneficiaryType === RevenueBeneficiaryType.PLATFORM) {
        await this.applyWalletCredit(tx, {
          userId: platformUserId,
          amount: split.amount,
          reason: WalletTransactionReason.ADJUSTMENT,
          referenceId: order.id,
          idempotencyKey: `order:${order.id}:platform:${productId}`,
          description: this.productSaleDescription,
        });
        continue;
      }
      if (split.beneficiaryType === RevenueBeneficiaryType.SUPPLIER) {
        if (!split.supplierId) {
          continue;
        }
        await this.applyWalletCredit(tx, {
          userId: split.supplierId,
          amount: split.amount,
          reason: WalletTransactionReason.ADJUSTMENT,
          referenceId: order.id,
          idempotencyKey: `order:${order.id}:supplier:${split.supplierId}:${productId}`,
          description: this.productSaleDescription,
        });
      }
    }
  }

  private async applySubscriptionDiscountUsage(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<void> {
    const usage = await tx.subscriptionDiscountUsage.findUnique({
      where: { orderId },
    });
    if (!usage || usage.consumedAt) {
      return;
    }

    await tx.subscription.updateMany({
      where: { id: usage.subscriptionId, discountRemaining: { gt: 0 } },
      data: { discountRemaining: { decrement: 1 } },
    });

    await tx.subscriptionDiscountUsage.update({
      where: { id: usage.id },
      data: { consumedAt: new Date() },
    });
  }

  private resolveBuyerDisplayName(
    buyer: {
      name: string | null;
      firstName: string | null;
      lastName: string | null;
      username: string | null;
    } | null,
  ): string {
    if (!buyer) {
      return 'کاربر';
    }
    const combined = `${buyer.firstName ?? ''} ${buyer.lastName ?? ''}`.trim();
    if (combined.length > 0) {
      return combined;
    }
    const name = buyer.name?.trim();
    if (name) {
      return name;
    }
    return buyer.username ?? 'کاربر';
  }

  private async notifyOrderEvents(orderId: string | null | undefined): Promise<void> {
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
    await this.notifyOrderPaid(order);
    await this.notifyOrderRevenueCredits(order);
  }

  private async notifyOrderRevenueCredits(
    order: FinanceOrder & { items: { productId: bigint; lineTotal: number }[] },
  ): Promise<void> {
    if ((order.orderKind as OrderKind) !== OrderKind.PRODUCT) {
      return;
    }
    if ((order.status as OrderStatus) !== OrderStatus.PAID) {
      return;
    }
    const supplierSplits = await this.prisma.financeOrderRevenueSplit.findMany({
      where: {
        orderId: order.id,
        beneficiaryType: RevenueBeneficiaryType.SUPPLIER,
      },
      select: { supplierId: true, amount: true, productId: true },
    });
    const { platformUserId } = this.getRevenueSplitConfig();

    const productIds = Array.from(
      new Set(order.items.map((item) => item.productId)),
    );
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, title: true, slug: true },
    });
    const productMap = new Map(
      products.map((product) => [
        product.id.toString(),
        { title: product.title, slug: product.slug },
      ]),
    );

    for (const item of order.items) {
      const productId = item.productId.toString();
      const { supplierIds, supplierCount } =
        await this.productsService.resolveContributors(productId);
      if (supplierCount !== 1 || supplierIds[0] !== platformUserId) {
        continue;
      }
      const productMeta = productMap.get(productId);
      const data = {
        orderId: order.id,
        productId,
        productTitle: productMeta?.title ?? 'محصول',
        productSlug: productMeta?.slug ?? null,
        amount: {
          value: item.lineTotal,
          currency: 'IRR' as const,
        },
        product: {
          id: productId,
          title: productMeta?.title ?? 'محصول',
          slug: productMeta?.slug ?? null,
        },
      };
      const actionUrl = this.notificationsService.buildActionUrl(
        NotificationType.WALLET_CREDITED,
        data,
      );
      const notificationId = await this.notificationsService.createNotification({
        type: NotificationType.WALLET_CREDITED,
        title: 'New notification',
        body: 'You have a new notification.',
        actionUrl,
        entityType: productMeta?.slug ? 'PRODUCT' : null,
        entitySlug: productMeta?.slug ?? null,
        entityId: productId,
        data,
      });
      await this.notificationsService.enqueueToUser(
        notificationId,
        platformUserId,
        `wallet_credit:order:${order.id}:${platformUserId}:${productId}`,
      );
    }

    for (const split of supplierSplits) {
      if (!split.supplierId || split.amount <= 0) {
        continue;
      }
      const productId = split.productId.toString();
      const productMeta = productMap.get(productId);
      const data = {
        orderId: order.id,
        productId,
        productTitle: productMeta?.title ?? 'محصول',
        productSlug: productMeta?.slug ?? null,
        amount: {
          value: split.amount,
          currency: 'IRR' as const,
        },
        product: {
          id: productId,
          title: productMeta?.title ?? 'محصول',
          slug: productMeta?.slug ?? null,
        },
      };
      const actionUrl = this.notificationsService.buildActionUrl(
        NotificationType.WALLET_CREDITED,
        data,
      );
      const notificationId = await this.notificationsService.createNotification({
        type: NotificationType.WALLET_CREDITED,
        title: 'New notification',
        body: 'You have a new notification.',
        actionUrl,
        entityType: productMeta?.slug ? 'PRODUCT' : null,
        entitySlug: productMeta?.slug ?? null,
        entityId: productId,
        data,
      });
      await this.notificationsService.enqueueToUser(
        notificationId,
        split.supplierId,
        `wallet_credit:order:${order.id}:${split.supplierId}:${productId}`,
      );
    }
  }

  private async notifyOrderPaid(order: FinanceOrder & { items: { productId: bigint }[] }) {
    if ((order.orderKind as OrderKind) !== OrderKind.PRODUCT) {
      return;
    }
    if ((order.status as OrderStatus) !== OrderStatus.PAID) {
      return;
    }
    const items = order.items ?? [];
    const buyer = await this.prisma.user.findUnique({
      where: { id: order.userId },
      select: { name: true, firstName: true, lastName: true, username: true, avatarUrl: true },
    });
    const actorName = this.resolveBuyerDisplayName(buyer);
    const productIds = items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, title: true, slug: true },
    });
    const productMap = new Map(
      products.map((product) => [
        product.id.toString(),
        { title: product.title, slug: product.slug },
      ]),
    );
    for (const item of items) {
      const productId = item.productId.toString();
      const contributors = await this.productsService.resolveContributors(
        productId,
      );
      if (contributors.supplierCount === 0) {
        continue;
      }
      const productMeta = productMap.get(productId);
      const productTitle = productMeta?.title ?? 'محصول';
      const productSlug = productMeta?.slug ?? null;
      const actor = {
        id: order.userId,
        fullName: actorName,
        username: buyer?.username ?? null,
        avatarUrl: buyer?.avatarUrl ?? null,
      };
      const product = {
        id: productId,
        title: productTitle,
        slug: productSlug,
      };
      for (const supplierId of contributors.supplierIds) {
        if (!supplierId) {
          continue;
        }
        const data = {
          orderId: order.id,
          actorId: order.userId,
          actorName,
          actorUsername: buyer?.username ?? null,
          actorAvatarUrl: buyer?.avatarUrl ?? null,
          productId,
          productTitle,
          productSlug,
          actor,
          product,
        };
        const actionUrl = this.notificationsService.buildActionUrl(
          NotificationType.PURCHASED_YOUR_PRODUCT,
          data,
        );
        const notificationId = await this.notificationsService.createNotification({
          type: NotificationType.PURCHASED_YOUR_PRODUCT,
          title: 'New notification',
          body: 'You have a new notification.',
          actionUrl,
          entityType: productSlug ? 'PRODUCT' : null,
          entitySlug: productSlug ?? null,
          entityId: productId,
          data,
        });
        await this.notificationsService.enqueueToUser(
          notificationId,
          supplierId,
          `purchase:${order.id}:${supplierId}:${productId}`,
        );
      }
    }
  }

  private async notifyWalletCreditFromPayment(
    payment: FinancePayment | null,
  ): Promise<void> {
    if (!payment) {
      return;
    }
    const purpose = payment.purpose as PaymentPurpose | null;
    const refType = payment.referenceType as PaymentReferenceType | null;
    const isWalletTopup =
      purpose === PaymentPurpose.WALLET_TOPUP ||
      (!purpose && refType === PaymentReferenceType.WALLET_CHARGE);
    if (!isWalletTopup) {
      return;
    }
    if ((payment.status as PaymentStatus) !== PaymentStatus.SUCCESS) {
      return;
    }
    const walletTx = await this.prisma.financeWalletTransaction.findFirst({
      where: {
        referenceId: payment.id,
        userId: payment.userId,
        type: WalletTransactionType.CREDIT,
        status: WalletTransactionStatus.SUCCESS,
      },
      select: { id: true },
    });
    if (!walletTx) {
      return;
    }
    const data = {
      amount: {
        value: payment.amount,
        currency: 'IRR',
      },
    };
    const actionUrl = this.notificationsService.buildActionUrl(
      NotificationType.WALLET_CREDITED,
      data,
    );
    const notificationId = await this.notificationsService.createNotification({
      type: NotificationType.WALLET_CREDITED,
      title: 'New notification',
      body: 'You have a new notification.',
      actionUrl,
      data,
    });
    await this.notificationsService.enqueueToUser(
      notificationId,
      payment.userId,
      `wallet_credit:${walletTx.id}:${payment.userId}`,
    );
  }
}
