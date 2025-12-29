import { Module } from '@nestjs/common';
import { RevenueService } from '@app/finance/revenue/revenue.service';
import { RevenueController } from '@app/finance/revenue/revenue.controller';
import { SupplierReportingController } from '@app/finance/revenue/supplier-reporting.controller';
import { SupplierReportingService } from '@app/finance/revenue/supplier-reporting.service';
import { ProductsModule } from '@app/finance/products/products.module';

@Module({
  imports: [ProductsModule],
  controllers: [RevenueController, SupplierReportingController],
  providers: [RevenueService, SupplierReportingService],
  exports: [RevenueService],
})
export class RevenueModule {}
