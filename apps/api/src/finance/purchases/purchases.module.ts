import { Module } from '@nestjs/common';
import { PurchasesController } from '@app/finance/purchases/purchases.controller';
import { AdminPurchasesController } from '@app/finance/purchases/admin-purchases.controller';
import { PurchasesService } from '@app/finance/purchases/purchases.service';
import { DownloadsModule } from '@app/finance/downloads/downloads.module';

@Module({
  imports: [DownloadsModule],
  controllers: [PurchasesController, AdminPurchasesController],
  providers: [PurchasesService],
})
export class PurchasesModule {}
