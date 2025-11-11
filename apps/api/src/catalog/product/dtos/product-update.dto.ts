import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { GraphicFormat, PricingType, ProductStatus } from '@prisma/client';
import {
  ProductAssetInputDto,
  ProductFileInputDto,
  ProductTopicLinkDto,
} from '@app/catalog/product/dtos/product-shared.dto';
import {
  toBigIntString,
  toBigIntStringArray,
  toColorArray,
  toStringArray,
  toTrimmedString,
  toUppercaseStringArray,
} from '@app/catalog/product/dtos/transformers';
import { FA_SLUG_REGEX } from '@shared-slug/slug/fa-slug.util';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'نقاشی-و-تصویرسازی' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(FA_SLUG_REGEX, { message: 'Invalid slug format' })
  @Transform(toTrimmedString)
  slug?: string;

  @ApiPropertyOptional({ example: 'قلم سیاه – وکتور خوشنویسی' })
  @IsOptional()
  @IsString()
  @Length(2, 255)
  @Transform(toTrimmedString)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 20000)
  @Transform(toTrimmedString)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  coverUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 80)
  @Transform(toTrimmedString)
  shortLink?: string;

  @ApiPropertyOptional({
    description:
      'ID فایل اصلی (BigInt به صورت رشته). برای حذف فایل، مقدار null ارسال کنید.',
  })
  @IsOptional()
  @Transform(toBigIntString)
  @IsString()
  fileId?: string | null;

  @ApiPropertyOptional({
    type: () => ProductFileInputDto,
    description:
      'برای ساخت ProductFile جدید هنگام ویرایش. با fileId (به جز null) قابل جمع نیست.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductFileInputDto)
  file?: ProductFileInputDto;

  @ApiPropertyOptional({
    enum: GraphicFormat,
    isArray: true,
    example: [GraphicFormat.SVG, GraphicFormat.PNG],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Transform(toUppercaseStringArray)
  @IsEnum(GraphicFormat, { each: true })
  graphicFormats?: GraphicFormat[];

  @ApiPropertyOptional({
    type: [String],
    description: 'HEX colors (#RRGGBB)',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Transform(toColorArray)
  colors?: string[];

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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Transform(toStringArray)
  seoKeywords?: string[];

  @ApiPropertyOptional({ enum: PricingType })
  @IsOptional()
  @IsEnum(PricingType)
  pricingType?: PricingType;

  @ApiPropertyOptional({ example: 49000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number | null;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ example: '2025-11-08T12:00:00.000Z' })
  @IsOptional()
  @IsString()
  publishedAt?: string | null;

  @ApiPropertyOptional({
    description: 'حجم فایل بر حسب مگابایت (برای فیلترهای کلاینت)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fileSizeMB?: number;

  @ApiPropertyOptional({
    description: 'اندازه فایل به بایت (BigInt به صورت رشته)',
  })
  @IsOptional()
  @Transform(toBigIntString)
  @IsString()
  fileBytes?: string | null;

  @ApiPropertyOptional({
    type: [ProductAssetInputDto],
    description: 'در صورت ارسال، تمام دارایی‌ها با این لیست جایگزین می‌شوند',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAssetInputDto)
  assets?: ProductAssetInputDto[];

  @ApiPropertyOptional({
    type: [ProductTopicLinkDto],
    description:
      'در صورت ارسال، ارتباط موضوعی محصول دقیقاً مطابق این لیست به‌روز می‌شود',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductTopicLinkDto)
  topics?: ProductTopicLinkDto[];

  @ApiPropertyOptional({
    type: [String],
    description: 'آیدی‌های دسته‌بندی (BigInt به صورت رشته)',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Transform(toBigIntStringArray)
  categoryIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'آیدی‌های تگ (BigInt به صورت رشته)',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Transform(toBigIntStringArray)
  tagIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'نویسندگان محصول (UUID، حداکثر ۳ نفر)',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(3)
  @Transform(toStringArray)
  authorIds?: string[];
}
