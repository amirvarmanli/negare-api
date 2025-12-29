import { Module } from '@nestjs/common';
import { DownloadsService } from '@app/finance/downloads/downloads.service';
import { DownloadsController } from '@app/finance/downloads/downloads.controller';
import { ProductsModule } from '@app/finance/products/products.module';
import { EntitlementsModule } from '@app/finance/entitlements/entitlements.module';
import { SubscriptionsModule } from '@app/finance/subscriptions/subscriptions.module';
import { DownloadTokensService } from '@app/finance/downloads/download-tokens.service';
import { CatalogModule } from '@app/catalog/catalog.module';

@Module({
  imports: [ProductsModule, EntitlementsModule, SubscriptionsModule, CatalogModule],
  controllers: [DownloadsController],
  providers: [DownloadsService, DownloadTokensService],
  exports: [DownloadTokensService],
})
export class DownloadsModule {}
