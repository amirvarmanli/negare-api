// apps/api/src/core/catalog/product/dto/product-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PricingType, ProductStatus, GraphicFormat } from '@prisma/client';
import { toBigIntString, toTrimmedString } from '@app/catalog/product/dtos/transformers';

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
  @Transform(toBigIntString)
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'BigInt به صورت رشته' })
  @IsOptional()
  @Transform(toBigIntString)
  @IsString()
  tagId?: string;

  @ApiPropertyOptional({ description: 'آیدی تاپیک (BigInt به صورت رشته)' })
  @IsOptional()
  @Transform(toBigIntString)
  @IsString()
  topicId?: string;

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

  @ApiPropertyOptional({ enum: GraphicFormat })
  @IsOptional()
  @IsEnum(GraphicFormat)
  graphicFormat?: GraphicFormat;

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
