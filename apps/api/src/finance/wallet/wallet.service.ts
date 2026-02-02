import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '@app/prisma/prisma.service';
import {
  WalletTransactionReason,
  WalletTransactionStatus,
  WalletTransactionType,
} from '@app/finance/common/finance.enums';
import {
  buildPaginationMeta,
  type PaginationMeta,
} from '@app/common/dto/pagination.dto';
import type {
  FinanceWallet,
  FinanceWalletTransaction,
  FinanceWalletTransactionReason,
  FinanceWalletTransactionStatus,
  FinanceWalletTransactionType,
  Prisma,
} from '@prisma/client';
import { AllConfig } from '@app/config/config.module';
import { NotificationsService } from '@app/notifications/notifications.service';
import { requestTraceStorage } from '@app/common/tracing/request-trace';
import { walletReasonDisplay } from '@app/finance/wallet/wallet-reason.mapper';

export interface WalletTransactionNotificationMetadata {
  orderId?: string | null;
  paymentId?: string | null;
  productId?: string | number | null;
  productSlug?: string | null;
  couponCode?: string | null;
  actorUserId?: string | null;
}

export interface CreateWalletTransactionInput {
  walletId: string;
  userId: string;
  type: WalletTransactionType;
  reason: WalletTransactionReason;
  status?: WalletTransactionStatus;
  amount: number;
  balanceAfter?: number | null;
  referenceId?: string | null;
  description?: string | null;
  idempotencyKey?: string | null;
  notificationMetadata?: WalletTransactionNotificationMetadata | null;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly config: ConfigService<AllConfig>,
  ) {}

  async getOrCreateWallet(userId: string): Promise<FinanceWallet> {
    const existing = await this.prisma.financeWallet.findUnique({
      where: { userId },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.financeWallet.create({
      data: { userId, balance: 0, currency: 'TOMAN' },
    });
  }

  async getOrCreateWalletInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<FinanceWallet> {
    const existing = await tx.financeWallet.findUnique({
      where: { userId },
    });
    if (existing) {
      return existing;
    }
    return tx.financeWallet.create({
      data: { userId, balance: 0, currency: 'TOMAN' },
    });
  }

  async getWallet(userId: string): Promise<FinanceWallet> {
    return this.getOrCreateWallet(userId);
  }

  async getBalance(userId: string): Promise<number> {
    const wallet = await this.getOrCreateWallet(userId);
    return wallet.balance;
  }

  async getBalanceInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<number> {
    const wallet = await this.getOrCreateWalletInTransaction(tx, userId);
    return wallet.balance;
  }

  async listTransactions(
    userId: string,
    params: { page?: number; limit?: number },
  ): Promise<{ items: FinanceWalletTransaction[]; meta: PaginationMeta }> {
    const wallet = await this.getOrCreateWallet(userId);
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit =
      params.limit && params.limit > 0 ? Math.min(params.limit, 50) : 20;
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.financeWalletTransaction.findMany({
        where: { walletId: wallet.id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.financeWalletTransaction.count({
        where: { walletId: wallet.id },
      }),
    ]);

    return {
      items,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async createTransaction(
    tx: Prisma.TransactionClient,
    input: CreateWalletTransactionInput,
  ): Promise<FinanceWalletTransaction> {
    const created = await tx.financeWalletTransaction.create({
      data: {
        walletId: input.walletId,
        userId: input.userId,
        type: input.type as FinanceWalletTransactionType,
        reason: input.reason as FinanceWalletTransactionReason,
        status: (input.status ?? WalletTransactionStatus.PENDING) as FinanceWalletTransactionStatus,
        amount: input.amount,
        balanceAfter: input.balanceAfter ?? null,
        referenceId: input.referenceId ?? null,
        description: input.description ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });

    const traceId = requestTraceStorage.getStore()?.traceId ?? 'unknown';
    this.logger.log(
      `wallet-transaction created traceId=${traceId} walletTxId=${created.id} walletUserId=${created.userId} reason=${created.reason} amount=${created.amount}`,
    );

    await this.notifyPlatformOwnerOfTransaction(created, input, traceId);

    return created;
  }

  private async notifyPlatformOwnerOfTransaction(
    transaction: FinanceWalletTransaction,
    input: CreateWalletTransactionInput,
    traceId: string,
  ): Promise<void> {
    const platformUserId = this.resolvePlatformWalletOwnerId(traceId);
    const metadata = input.notificationMetadata ?? null;
    const { orderId, paymentId } = this.deriveReferenceIds(
      input.reason,
      input.referenceId,
      metadata,
    );
 
    const actorUserId = metadata?.actorUserId ?? transaction.userId;
    const direction =
      transaction.type === WalletTransactionType.CREDIT ? 'increase' : 'decrease';
    const directionLabel =
      direction === 'increase' ? 'افزایش' : 'کاهش';
    const amountLabel = new Intl.NumberFormat('fa-IR').format(transaction.amount);
    const relatedText = this.buildRelatedParts(orderId, paymentId, metadata);
    const idempotencyKeyText =
      input.idempotencyKey && input.idempotencyKey.length > 0
        ? input.idempotencyKey
        : 'ندارد';
    const timestamp = transaction.createdAt.toISOString();
    const title =
      direction === 'increase'
        ? 'افزایش موجودی کیف پول'
        : 'کاهش موجودی کیف پول';
    const displayReason = walletReasonDisplay(
      transaction.reason,
      transaction.description ?? null,
    );

    const body = [
      `مبلغ ${amountLabel} تومان (${directionLabel})`,
      `دلیل: ${displayReason}`,
      `مرجع: ${relatedText}`,
      `کلید یکتا: ${idempotencyKeyText}`,
      `زمان ثبت: ${timestamp}`,
    ].join('\n');

    const links = this.buildNotificationLinks(
      transaction.userId,
      actorUserId,
      orderId,
      paymentId,
      metadata,
    );

    const data: Prisma.InputJsonValue = {
      type: transaction.type,
      amount: transaction.amount,
      direction,
      reason: transaction.reason,
      displayReason,
      walletUserId: transaction.userId,
      orderId: orderId ?? undefined,
      paymentId: paymentId ?? undefined,
      actorUserId,
      couponCode: metadata?.couponCode ?? undefined,
      productId: metadata?.productId ?? undefined,
      links,
      timestamp,
      traceId,
    } as Prisma.InputJsonValue;

    try {
      this.logger.log(
        `wallet-transaction notification attempt traceId=${traceId} walletTxId=${transaction.id} walletUserId=${transaction.userId} reason=${transaction.reason} amount=${transaction.amount}`,
      );
      const notificationId = await this.notificationsService.createNotification({
        type: NotificationType.WALLET_TRANSACTION_RECORDED,
        title,
        body,
        data,
      });
      const dedupeKey = `wallet_tx:${transaction.id}`;
      await this.notificationsService.enqueueToUser(
        notificationId,
        platformUserId,
        dedupeKey,
        {
          traceId,
          walletTxId: transaction.id,
          walletUserId: transaction.userId,
          reason: transaction.reason,
          amount: transaction.amount,
        },
      );
      this.logger.log(
        `wallet-transaction notification queued traceId=${traceId} walletTxId=${transaction.id} walletUserId=${transaction.userId} reason=${transaction.reason} amount=${transaction.amount}`,
      );
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(
        `wallet-transaction notification failed traceId=${traceId} walletTxId=${transaction.id} walletUserId=${transaction.userId} reason=${transaction.reason} amount=${transaction.amount}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private resolvePlatformWalletOwnerId(traceId: string): string {
    const platformUserId = this.config.get<string>('PLATFORM_WALLET_USER_ID');
    if (!platformUserId) {
      const message = 'PLATFORM_WALLET_USER_ID is not configured.';
      this.logger.error(`${message} traceId=${traceId}`);
      throw new InternalServerErrorException(message);
    }
    return platformUserId;
  }

  private deriveReferenceIds(
    reason: WalletTransactionReason,
    referenceId?: string | null,
    metadata?: WalletTransactionNotificationMetadata | null,
  ): { orderId?: string | null; paymentId?: string | null } {
    if (metadata?.orderId) {
      return { orderId: metadata.orderId, paymentId: metadata.paymentId ?? null };
    }
    if (metadata?.paymentId) {
      return { paymentId: metadata.paymentId, orderId: metadata.orderId ?? null };
    }
    if (!referenceId) {
      return {};
    }
    const orderReasons = new Set<WalletTransactionReason>([
      WalletTransactionReason.ORDER_PAYMENT,
      WalletTransactionReason.PLATFORM_DISCOUNT,
      WalletTransactionReason.ADJUSTMENT,
    ]);
    const paymentReasons = new Set<WalletTransactionReason>([
      WalletTransactionReason.TOPUP,
      WalletTransactionReason.REFUND,
      WalletTransactionReason.WITHDRAWAL,
      WalletTransactionReason.DONATION,
      WalletTransactionReason.PHOTO_RESTORE,
    ]);
    if (orderReasons.has(reason)) {
      return { orderId: referenceId };
    }
    if (paymentReasons.has(reason)) {
      return { paymentId: referenceId };
    }
    return { orderId: referenceId };
  }

  private buildRelatedParts(
    orderId?: string | null,
    paymentId?: string | null,
    metadata?: WalletTransactionNotificationMetadata | null,
  ): string {
    const parts: string[] = [];
    if (orderId) {
      parts.push(`سفارش #${orderId}`);
    }
    if (paymentId) {
      parts.push(`پرداخت #${paymentId}`);
    }
    const productLabel =
      metadata?.productSlug ??
      (metadata?.productId ? metadata.productId.toString() : null);
    if (productLabel) {
      parts.push(`محصول ${productLabel}`);
    }
    if (metadata?.couponCode) {
      parts.push(`کوپن ${metadata.couponCode}`);
    }
    if (parts.length === 0) {
      return 'بدون مرجع';
    }
    return parts.join('، ');
  }

  private buildNotificationLinks(
    walletUserId: string,
    actorUserId: string | null | undefined,
    orderId?: string | null,
    paymentId?: string | null,
    metadata?: WalletTransactionNotificationMetadata | null,
  ): Record<string, string> {
    const links: Record<string, string> = {
      wallet: `/admin/finance/wallets/${walletUserId}`,
    };
    if (orderId) {
      links.order = `/admin/orders/${orderId}`;
    }
    if (paymentId) {
      links.payment = `/admin/finance/payments/${paymentId}`;
    }
    const actorId = actorUserId ?? walletUserId;
    if (actorId) {
      links.user = `/admin/users/${actorId}`;
    }
    const productSlugOrId =
      metadata?.productSlug ??
      (metadata?.productId ? metadata.productId.toString() : null);
    if (productSlugOrId) {
      links.product = `/products/${productSlugOrId}`;
    }
    return links;
  }
}
