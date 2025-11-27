import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ProductSort } from '@app/catalog/product/dtos/product-query.dto';
import { toTrimmedString } from '@app/catalog/product/dtos/transformers';

const PRODUCT_SORTS: ProductSort[] = ['latest', 'popular', 'viewed', 'liked'];

export class ArtistProductsQueryDto {
  @ApiPropertyOptional({
    enum: PRODUCT_SORTS,
    example: 'latest',
  })
  @IsOptional()
  @IsString()
  @IsIn(PRODUCT_SORTS)
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
  @Transform(toTrimmedString)
  cursor?: string;
}
