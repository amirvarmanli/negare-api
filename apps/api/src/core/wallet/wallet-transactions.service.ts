import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { FindWalletTransactionsQueryDto } from './dto/find-wallet-transactions-query.dto';
import { WalletTransaction } from './wallet-transaction.entity';

@Injectable()
export class WalletTransactionsService {
  constructor(
    @InjectRepository(WalletTransaction)
    private readonly walletTransactionsRepository: Repository<WalletTransaction>,
  ) {}

  async findAll(
    query: FindWalletTransactionsQueryDto,
  ): Promise<WalletTransaction[]> {
    const qb = this.createBaseQuery(query);
    return qb.getMany();
  }

  async findByWallet(
    walletId: string,
    query: FindWalletTransactionsQueryDto,
  ): Promise<WalletTransaction[]> {
    return this.createBaseQuery(query)
      .andWhere('transaction.walletId = :walletId', { walletId })
      .getMany();
  }

  findById(id: string): Promise<WalletTransaction | null> {
    return this.walletTransactionsRepository.findOne({
      where: { id },
      relations: { wallet: true, user: true },
    });
  }

  findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<WalletTransaction | null> {
    return this.walletTransactionsRepository.findOne({
      where: { idempotencyKey },
      relations: { wallet: true, user: true },
    });
  }

  private createBaseQuery(
    query: FindWalletTransactionsQueryDto,
  ): SelectQueryBuilder<WalletTransaction> {
    const qb = this.walletTransactionsRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.wallet', 'wallet')
      .leftJoinAndSelect('transaction.user', 'user')
      .orderBy('transaction.createdAt', 'DESC')
      .take(query.limit ?? 25);

    if (query.cursor) {
      qb.andWhere('transaction.id < :cursor', { cursor: query.cursor });
    }

    if (query.userId) {
      qb.andWhere('transaction.userId = :userId', {
        userId: query.userId,
      });
    }

    if (query.walletId) {
      qb.andWhere('transaction.walletId = :walletId', {
        walletId: query.walletId,
      });
    }

    if (query.type) {
      qb.andWhere('transaction.type = :type', { type: query.type });
    }

    if (query.status) {
      qb.andWhere('transaction.status = :status', { status: query.status });
    }

    if (query.refType) {
      qb.andWhere('transaction.refType = :refType', {
        refType: query.refType,
      });
    }

    if (query.from) {
      qb.andWhere('transaction.createdAt >= :from', {
        from: query.from,
      });
    }

    if (query.to) {
      qb.andWhere('transaction.createdAt <= :to', {
        to: query.to,
      });
    }

    return qb;
  }
}
