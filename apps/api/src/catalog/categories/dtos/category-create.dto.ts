import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { toTrimmedString } from '@app/catalog/product/dtos/transformers';
import { FA_SLUG_REGEX } from '@shared-slug/slug/fa-slug.util';

export class CreateCategoryDto {
  @ApiProperty({ example: 'وکتور' })
  @IsString()
  @Length(2, 255)
  @Transform(toTrimmedString)
  name!: string;

  @ApiPropertyOptional({ example: 'نقاشی-و-تصویرسازی' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(FA_SLUG_REGEX, { message: 'Invalid slug format' })
  @Transform(toTrimmedString)
  slug?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.negare.test/categories/vector.png',
  })
  @IsOptional()
  @IsUrl()
  coverUrl?: string;

  @ApiPropertyOptional({
    description: 'Parent ID (BigInt as string)',
    example: '123',
  })
  @IsOptional()
  @IsString()
  parentId?: string; // BigInt string
}
