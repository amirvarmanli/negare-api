import { Module } from '@nestjs/common';
import { ProductsService } from '@app/finance/products/products.service';

@Module({
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
