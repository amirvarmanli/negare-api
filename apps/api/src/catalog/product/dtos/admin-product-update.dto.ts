import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ProductStatus } from '@prisma/client';
import { AdminProductSaleType } from '@app/catalog/product/dtos/admin-products-query.dto';
import { UpdateProductDto } from '@app/catalog/product/dtos/product-update.dto';

export class AdminProductUpdateDto extends UpdateProductDto {
  @ApiPropertyOptional({
    enum: ProductStatus,
    description: 'Publish status used by the admin edit UI',
  })
  @IsOptional()
  @IsEnum(ProductStatus)
  publishStatus?: ProductStatus;

  @ApiPropertyOptional({
    enum: AdminProductSaleType,
    description: 'Sale type used by the admin edit UI',
  })
  @IsOptional()
  @IsEnum(AdminProductSaleType)
  saleType?: AdminProductSaleType;
}
