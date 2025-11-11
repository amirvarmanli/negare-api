import { Module } from '@nestjs/common';
import { ProductService } from '@app/catalog/product/product.service';
import { PrismaService } from '@app/prisma/prisma.service';
import { ProductController } from '@app/catalog/product/products.controller';

@Module({
  controllers: [ProductController],
  providers: [PrismaService, ProductService],
  exports: [ProductService],
})
export class ProductModule {}
