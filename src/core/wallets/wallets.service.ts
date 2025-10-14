import {
  ArgumentMetadata,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';
import {
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../wallet-transactions/wallet-transaction.entity';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { WalletBalanceDto } from './dto/wallet-balance.dto';
import { WalletOperationDto } from './dto/wallet-operation.dto';
import { Wallet, WalletCurrency } from './wallet.entity';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletsRepository: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private readonly walletTransactionsRepository: Repository<WalletTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  findAll(): Promise<Wallet[]> {
    return this.walletsRepository.find({
      relations: {
        user: true,
        transactions: true,
      },
    });
  }

  findByUserId(userId: string): Promise<Wallet | null> {
    return this.walletsRepository.findOne({
      where: { userId },
      relations: {
        user: true,
        transactions: true,
      },
    });
  }

  async getBalance(userId: string): Promise<WalletBalanceDto> {
    const wallet = await this.walletsRepository.findOne({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException(`Wallet for user ${userId} not found`);
    }

    return { balance: wallet.balance, currency: wallet.currency };
  }

  async createForUser(
    userId: string,
    dto?: CreateWalletDto,
  ): Promise<Wallet> {
    const existing = await this.findByUserId(userId);
    if (existing) {
      throw new ConflictException('Wallet already exists for user');
    }

    return this.walletsRepository.save(
      this.walletsRepository.create({
        userId,
        balance: '0',
        currency: dto?.currency ?? WalletCurrency.IRR,
      }),
    );
  }

  async credit(userId: string, dto: WalletOperationDto): Promise<WalletTransaction> {
    return this.processTransaction(userId, dto, WalletTransactionType.CREDIT);
  }

  async debit(userId: string, dto: WalletOperationDto): Promise<WalletTransaction> {
    return this.processTransaction(userId, dto, WalletTransactionType.DEBIT);
  }

  private async processTransaction(
    userId: string,
    dto: WalletOperationDto,
    type: WalletTransactionType,
  ): Promise<WalletTransaction> {
    const amount = this.parseAndValidateAmount(dto.amount);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let transactionId: string | null = null;

    try {
      const transactionRepository =
        queryRunner.manager.getRepository(WalletTransaction);

      const existingTransaction = await transactionRepository
        .createQueryBuilder('tx')
        .setLock('pessimistic_read')
        .where('tx.idempotencyKey = :key', {
          key: dto.idempotencyKey,
        })
        .getOne();

      if (existingTransaction) {
        transactionId = existingTransaction.id;
        await queryRunner.commitTransaction();
        return this.loadTransaction(transactionId);
      }

      const walletRepository = queryRunner.manager.getRepository(Wallet);
      const wallet = await walletRepository
        .createQueryBuilder('wallet')
        .setLock('pessimistic_write')
        .where('wallet.userId = :userId', { userId })
        .getOne();

      if (!wallet) {
        throw new NotFoundException(`Wallet for user ${userId} not found`);
      }

      const currentBalance = BigInt(wallet.balance);

      if (
        type === WalletTransactionType.DEBIT &&
        currentBalance < amount
      ) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_BALANCE',
          message: 'Not enough funds',
        });
      }

      const newBalance =
        type === WalletTransactionType.CREDIT
          ? currentBalance + amount
          : currentBalance - amount;

      wallet.balance = newBalance.toString();

      const transaction = transactionRepository.create({
        walletId: wallet.id,
        userId: wallet.userId,
        type,
        status: WalletTransactionStatus.COMPLETED,
        amount: amount.toString(),
        refType: dto.refType,
        refId: dto.refId ?? null,
        description: dto.description ?? null,
        idempotencyKey: dto.idempotencyKey,
        metadata: dto.metadata ?? null,
      });

      const savedTransaction = await transactionRepository.save(transaction);
      await walletRepository.save(wallet);

      transactionId = savedTransaction.id;

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (this.isDuplicateKeyError(error)) {
        const existing = await this.walletTransactionsRepository.findOne({
          where: { idempotencyKey: dto.idempotencyKey },
          relations: { wallet: true, user: true },
        });
        if (existing) {
          return existing;
        }
      }
      throw error;
    } finally {
      await queryRunner.release();
    }

    if (!transactionId) {
      throw new Error('Failed to resolve wallet transaction id');
    }

    return this.loadTransaction(transactionId);
  }

  private parseAndValidateAmount(amount: string): bigint {
    const metadata: ArgumentMetadata = {
      type: 'body',
      data: 'amount',
      metatype: String,
    };

    const parsed = new ParseBigIntPipe().transform(amount, metadata);

    if (parsed <= 0n) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'Amount must be greater than zero',
      });
    }

    return parsed;
  }

  private loadTransaction(id: string): Promise<WalletTransaction> {
    return this.walletTransactionsRepository.findOneOrFail({
      where: { id },
      relations: {
        wallet: true,
        user: true,
      },
    });
  }

  private isDuplicateKeyError(error: unknown): boolean {
    if (error instanceof QueryFailedError) {
      const code = error.driverError?.code;
      if (code === '23505') {
        return true;
      }
      const message: string | undefined = error.driverError?.message;
      if (message && message.includes('SQLITE_CONSTRAINT')) {
        return true;
      }
    }
    return false;
  }
}
