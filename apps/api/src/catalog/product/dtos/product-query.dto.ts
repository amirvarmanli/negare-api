// apps/api/src/core/catalog/product/dto/product-query.dto.ts
import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsIn,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PricingType, ProductStatus, GraphicFormat } from '@prisma/client';
import { toTrimmedString } from '@app/catalog/product/dtos/transformers';
import { FA_SLUG_REGEX } from '@shared-slug/slug/fa-slug.util';

export const TAG_NAME_REGEX = /^[^#,،\n]+$/u;

export type ProductSort = 'latest' | 'popular' | 'viewed' | 'liked';

export class ProductFindQueryDto {
  // متن جستجو
  @ApiPropertyOptional({ example: 'خوشنویسی' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  @Transform(toTrimmedString)
  q?: string;

  // فیلترها
  @ApiPropertyOptional({ description: 'BigInt به صورت رشته' })
  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'BigInt به صورت رشته' })
  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  tagId?: string;

  @ApiPropertyOptional({
    description: 'جستجو بر اساس نام تگ (پشتیبانی از فاصله)',
    example: 'طراحی مینیمال',
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  @Matches(TAG_NAME_REGEX, {
    message: 'Tag name can only contain letters, numbers, spaces, _ or -',
  })
  @Transform(toTrimmedString)
  tagName?: string;

  @ApiPropertyOptional({
    description: 'Tag slug (Persian-safe). Ignored when tagId is provided.',
    example: 'illustration',
  })
  @IsOptional()
  @IsString()
  @Matches(FA_SLUG_REGEX, { message: 'Invalid slug format' })
  @Transform(toTrimmedString)
  tagSlug?: string;

  @ApiPropertyOptional({ description: 'آیدی تاپیک (BigInt به صورت رشته)' })
  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({
    description: 'Topic slug (Persian-safe). Ignored when topicId is provided.',
  })
  @IsOptional()
  @IsString()
  @Matches(FA_SLUG_REGEX, { message: 'Invalid slug format' })
  @Transform(toTrimmedString)
  topicSlug?: string;

  @ApiPropertyOptional({ description: 'UUID نویسنده' })
  @IsOptional()
  @IsString()
  authorId?: string;

  @ApiPropertyOptional({
    description: 'فیلتر بر اساس رنگ HEX (#RRGGBB)',
    example: '#101010',
  })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/u, {
    message: 'Color must be HEX in the form #RRGGBB',
  })
  color?: string;

  @ApiPropertyOptional({
    description: 'تنها محصولاتی که فایل متصل دارند',
    example: 'true',
  })
  @IsOptional()
  @IsBooleanString()
  hasFile?: string;

  @ApiPropertyOptional({
    description: 'تنها محصولاتی که حداقل یک دارایی دارند',
    example: 'true',
  })
  @IsOptional()
  @IsBooleanString()
  hasAssets?: string;

  @ApiPropertyOptional({ enum: PricingType })
  @IsOptional()
  @IsEnum(PricingType)
  pricingType?: PricingType;

  @ApiPropertyOptional({
    enum: GraphicFormat,
    description: 'Comma-separated GraphicFormat values, e.g. "PSD,AI"',
  })
  @IsOptional()
  @IsString()
  graphicFormat?: string;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  // سورت و بارگیری
  @ApiPropertyOptional({
    enum: ['latest', 'popular', 'viewed', 'liked'],
    example: 'latest',
  })
  @IsOptional()
  @IsString()
  sort?: ProductSort;

  @ApiPropertyOptional({ minimum: 1, maximum: 60, example: 24 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  limit?: number;

  @ApiPropertyOptional({ description: 'cursor opaque (base64)' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class ProductRelatedQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 24, example: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  limit?: number;
}

const PRODUCT_SEARCH_FILTER_FIELDS = [
  'categoryId',
  'tagId',
  'tagName',
  'tagSlug',
  'topicId',
  'topicSlug',
  'authorId',
  'color',
  'hasFile',
  'hasAssets',
  'pricingType',
  'graphicFormat',
  'status',
] as const;

export class ProductSearchQueryDto extends PickType(
  ProductFindQueryDto,
  PRODUCT_SEARCH_FILTER_FIELDS,
) {
  @ApiProperty({
    description:
      'متن جستجو (الزامی). چندکلمه‌ای (AND) و پشتیبانی از عبارت دقیق با کوتیشن.',
    example: 'شهید بهشتی',
  })
  @Transform(toTrimmedString)
  @IsString()
  @Length(2, 255)
  q!: string;

  @ApiPropertyOptional({ minimum: 1, example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    enum: ['latest', 'popular', 'viewed', 'liked'],
    example: 'latest',
  })
  @IsOptional()
  @IsIn(['latest', 'popular', 'viewed', 'liked'])
  sort?: ProductSort;
}
