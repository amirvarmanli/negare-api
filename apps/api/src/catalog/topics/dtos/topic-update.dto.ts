import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateTopicDto {
  @ApiPropertyOptional({ example: 'طراحی داشبورد' })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  @Transform(toTrimmedString)
  name?: string;

  @ApiPropertyOptional({ example: 'نقاشی-و-تصویرسازی' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(FA_SLUG_REGEX, { message: 'Invalid slug format' })
  @Transform(toTrimmedString)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  coverUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 160)
  seoTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 240)
  seoDescription?: string;
}
