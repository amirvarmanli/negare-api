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

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 255)
  @Transform(toTrimmedString)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(FA_SLUG_REGEX, { message: 'Invalid slug format' })
  @Transform(toTrimmedString)
  slug?: string;

  @ApiPropertyOptional({
    description: 'Parent ID (BigInt as string) or empty to detach',
  })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Cover image URL' })
  @IsOptional()
  @IsUrl()
  coverUrl?: string;
}
