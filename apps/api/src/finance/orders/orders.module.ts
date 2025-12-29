import { Module } from '@nestjs/common';
import { OrdersService } from '@app/finance/orders/orders.service';
import { OrdersController } from '@app/finance/orders/orders.controller';
import { ProductsModule } from '@app/finance/products/products.module';
import { DiscountsModule } from '@app/finance/discounts/discounts.module';
import { DownloadsModule } from '@app/finance/downloads/downloads.module';

@Module({
  imports: [ProductsModule, DiscountsModule, DownloadsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
