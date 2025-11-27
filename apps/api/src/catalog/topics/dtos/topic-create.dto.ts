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

export class CreateTopicDto {
  @ApiProperty({ example: 'طراحی داشبورد' })
  @IsString()
  @Length(2, 120)
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
    description: 'Optional cover image URL',
    example: 'https://cdn.negare.test/topics/dashboard.png',
  })
  @IsOptional()
  @IsUrl()
  coverUrl?: string;

  @ApiPropertyOptional({
    example: 'راهنمای کامل طراحی داشبوردهای حرفه‌ای',
  })
  @IsOptional()
  @IsString()
  @Length(0, 160)
  seoTitle?: string;

  @ApiPropertyOptional({
    example:
      'تاپیک طراحی داشبورد شامل مجموعه‌ای از آموزش‌ها و فایل‌های حرفه‌ای UI/UX.',
  })
  @IsOptional()
  @IsString()
  @Length(0, 550)
  seoDescription?: string;
}
