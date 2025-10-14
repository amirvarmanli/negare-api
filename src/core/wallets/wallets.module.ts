import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletTransaction } from '../wallet-transactions/wallet-transaction.entity';
import { Wallet } from './wallet.entity';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, WalletTransaction])],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService, TypeOrmModule],
})
export class WalletsModule {}
