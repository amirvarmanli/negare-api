import { Injectable } from '@nestjs/common';
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
}

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

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
    return tx.financeWalletTransaction.create({
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
  }
}
