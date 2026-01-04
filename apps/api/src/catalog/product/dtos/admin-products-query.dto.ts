import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ProductStatus } from '@prisma/client';
import { toTrimmedString } from '@app/catalog/product/dtos/transformers';

export enum AdminProductSortBy {
  createdAt = 'createdAt',
  updatedAt = 'updatedAt',
  price = 'price',
  title = 'title',
}

export enum AdminProductOrder {
  asc = 'asc',
  desc = 'desc',
}

export enum AdminProductSaleType {
  FREE = 'FREE',
  PAID = 'PAID',
  SUBSCRIPTION = 'SUBSCRIPTION',
}

export class AdminProductsListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Search products or artists by title/slug/id/displayName/username',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(toTrimmedString)
  q?: string;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  publishStatus?: ProductStatus;

  @ApiPropertyOptional({
    description: 'Category id (BigInt as string)',
  })
  @IsOptional()
  @IsString()
  @Transform(toTrimmedString)
  @Matches(/^\d+$/u)
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Topic id (BigInt as string)',
  })
  @IsOptional()
  @IsString()
  @Transform(toTrimmedString)
  @Matches(/^\d+$/u)
  topicId?: string;

  @ApiPropertyOptional({ enum: AdminProductSaleType })
  @IsOptional()
  @IsEnum(AdminProductSaleType)
  saleType?: AdminProductSaleType;

  @ApiPropertyOptional({
    description: 'Artist/owner user id (UUID)',
  })
  @IsOptional()
  @IsString()
  @Transform(toTrimmedString)
  @IsUUID()
  artistId?: string;

  @ApiPropertyOptional({
    enum: AdminProductSortBy,
    default: AdminProductSortBy.createdAt,
  })
  @IsOptional()
  @IsEnum(AdminProductSortBy)
  sortBy?: AdminProductSortBy;

  @ApiPropertyOptional({
    enum: AdminProductOrder,
    default: AdminProductOrder.desc,
  })
  @IsOptional()
  @IsEnum(AdminProductOrder)
  order?: AdminProductOrder;
}

export class AdminProductsMineQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Search products by title/slug/id',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(toTrimmedString)
  q?: string;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  publishStatus?: ProductStatus;

  @ApiPropertyOptional({
    description: 'Category id (BigInt as string)',
  })
  @IsOptional()
  @IsString()
  @Transform(toTrimmedString)
  @Matches(/^\d+$/u)
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Topic id (BigInt as string)',
  })
  @IsOptional()
  @IsString()
  @Transform(toTrimmedString)
  @Matches(/^\d+$/u)
  topicId?: string;

  @ApiPropertyOptional({ enum: AdminProductSaleType })
  @IsOptional()
  @IsEnum(AdminProductSaleType)
  saleType?: AdminProductSaleType;

  @ApiPropertyOptional({
    enum: AdminProductSortBy,
    default: AdminProductSortBy.createdAt,
  })
  @IsOptional()
  @IsEnum(AdminProductSortBy)
  sortBy?: AdminProductSortBy;

  @ApiPropertyOptional({
    enum: AdminProductOrder,
    default: AdminProductOrder.desc,
  })
  @IsOptional()
  @IsEnum(AdminProductOrder)
  order?: AdminProductOrder;
}
