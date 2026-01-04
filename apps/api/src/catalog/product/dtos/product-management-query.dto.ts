import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PricingType, ProductStatus } from '@prisma/client';
import { toTrimmedString } from '@app/catalog/product/dtos/transformers';

export enum ProductManagementSortBy {
  createdAt = 'createdAt',
  updatedAt = 'updatedAt',
  price = 'price',
  views = 'views',
  status = 'status',
}

export enum SortDirection {
  asc = 'asc',
  desc = 'desc',
}

const toBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return undefined;
};

export class ProductManagementQueryDto {
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

  @ApiPropertyOptional({ description: 'Search title/slug/description' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(toTrimmedString)
  q?: string;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ description: 'Owner user id (UUID)' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(toTrimmedString)
  ownerId?: string;

  @ApiPropertyOptional({ description: 'Category id (BigInt as string)' })
  @IsOptional()
  @IsString()
  @Transform(toTrimmedString)
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Topic id (BigInt as string)' })
  @IsOptional()
  @IsString()
  @Transform(toTrimmedString)
  topicId?: string;

  @ApiPropertyOptional({ description: 'Tag id (BigInt as string)' })
  @IsOptional()
  @IsString()
  @Transform(toTrimmedString)
  tagId?: string;

  @ApiPropertyOptional({ enum: PricingType })
  @IsOptional()
  @IsEnum(PricingType)
  pricingType?: PricingType;

  @ApiPropertyOptional({
    enum: ProductManagementSortBy,
    default: ProductManagementSortBy.createdAt,
  })
  @IsOptional()
  @IsEnum(ProductManagementSortBy)
  sortBy?: ProductManagementSortBy;

  @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.desc })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDir?: SortDirection;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  includeOwner?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  includeRelations?: boolean;
}
