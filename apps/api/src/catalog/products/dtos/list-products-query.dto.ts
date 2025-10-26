import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum ProductSortOption {
  NEWEST = 'newest',
  POPULAR = 'popular',
  DOWNLOADS = 'downloads',
  LIKES = 'likes',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
}

export class ListProductsQueryDto {
  @ApiProperty({
    description: 'Full-text search across product title and description',
    required: false,
    example: 'dashboard',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  q?: string;

  @ApiProperty({
    description: 'Filter by category id or slug',
    required: false,
    example: 'ui-kits',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    description: 'Filter by tag id or slug',
    required: false,
    example: 'dashboard',
  })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiProperty({
    description: 'Filter by supplier identifier (UUID)',
    required: false,
    example: '9e2b4a2c-4c06-4bda-9410-ffb34412dd84',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : String(value),
  )
  @IsString()
  supplierId?: string;

  @ApiProperty({
    description:
      'Filter by one or multiple pricing types (comma separated values supported)',
    required: false,
    example: 'FREE,PAID',
  })
  @IsOptional()
  @IsString()
  pricingType?: string;

  @ApiProperty({
    description: 'Filter by product visibility status',
    required: false,
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;

  @ApiProperty({
    description: 'Sorting strategy to apply',
    enum: ProductSortOption,
    required: false,
    default: ProductSortOption.NEWEST,
  })
  @IsOptional()
  @IsEnum(ProductSortOption)
  sort?: ProductSortOption = ProductSortOption.NEWEST;

  @ApiProperty({
    description: 'Requested page number (1-indexed)',
    required: false,
    default: 1,
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiProperty({
    description: 'Items per page',
    required: false,
    default: 24,
    example: 24,
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(100)
  limit = 24;
}
