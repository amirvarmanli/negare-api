import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletAuditService } from './wallet-audit.service';
import { WalletAuditLog } from './entities/wallet-audit-log.entity';
import { WalletController } from './wallet.controller';
import { Wallet } from './wallet.entity';
import { WalletRateLimitService } from './wallet-rate-limit.service';
import { WalletReadService } from './wallet-read.service';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { WalletTransactionsController } from './wallet-transactions.controller';
import { WalletTransaction } from './wallet-transaction.entity';
import { WalletTransactionsService } from './wallet-transactions.service';
import { RedisModule } from '@app/redis/redis.module';

@Module({
  imports: [
    ConfigModule,
    RedisModule,
    TypeOrmModule.forFeature([Wallet, WalletTransaction, WalletAuditLog]),
  ],
  controllers: [
    WalletController,
    WalletsController,
    WalletTransactionsController,
  ],
  providers: [
    WalletsService,
    WalletReadService,
    WalletTransactionsService,
    WalletAuditService,
    WalletRateLimitService,
  ],
  exports: [
    WalletsService,
    WalletReadService,
    WalletTransactionsService,
    WalletAuditService,
    WalletRateLimitService,
    TypeOrmModule,
  ],
})
export class WalletModule {}
