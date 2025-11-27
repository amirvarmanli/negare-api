import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PricingType, ProductStatus, GraphicFormat } from '@prisma/client';
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

export class CreateProductDto {
  @ApiPropertyOptional({ example: 'نقاشی-و-تصویرسازی' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(FA_SLUG_REGEX, { message: 'Invalid slug format' })
  @Transform(toTrimmedString)
  slug?: string;

  @ApiProperty({ example: 'قلم سیاه – وکتور خوشنویسی' })
  @IsString()
  @Length(2, 255)
  @Transform(toTrimmedString)
  title!: string;

  @ApiPropertyOptional({ example: 'فایل وکتور مناسب چاپ، فرمت EPS و SVG' })
  @IsOptional()
  @IsString()
  @Length(0, 20000)
  @Transform(toTrimmedString)
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/cover/abc.jpg' })
  @IsOptional()
  @IsUrl()
  coverUrl?: string;

  @ApiPropertyOptional({
    example: 'p/ghalam-siah',
    description: 'اختیاری؛ برای ساخت لینک کوتاه یکتا',
  })
  @IsOptional()
  @IsString()
  @Length(2, 80)
  @Transform(toTrimmedString)
  shortLink?: string;

  @ApiPropertyOptional({
    description:
      'UUID فایلی که پس از finish آپلود دریافت شده است. با ارسال این شناسه، فایل به عنوان ProductFile متصل می‌شود.',
    example: '4e7e3e5d-90d7-4f61-b4fd-1a60119e2fc8',
  })
  @IsOptional()
  @IsUUID()
  fileId?: string;

  @ApiPropertyOptional({
    type: () => ProductFileInputDto,
    description:
      'برای ساخت ProductFile جدید. این فیلد و fileId نباید همزمان ارسال شوند.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductFileInputDto)
  file?: ProductFileInputDto;

  @ApiProperty({
    enum: GraphicFormat,
    isArray: true,
    example: [GraphicFormat.SVG, GraphicFormat.EPS],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @Transform(toUppercaseStringArray)
  @IsEnum(GraphicFormat, { each: true })
  graphicFormats!: GraphicFormat[];

  @ApiPropertyOptional({
    type: [String],
    description: 'کدهای رنگ HEX به صورت #RRGGBB',
    example: ['#101010', '#FFD000'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Transform(toColorArray)
  colors?: string[];

  @ApiPropertyOptional({ example: 'دانلود وکتور خوشنویسی قلم سیاه' })
  @IsOptional()
  @IsString()
  @Length(0, 160)
  seoTitle?: string;

  @ApiPropertyOptional({
    example: 'وکتور خوشنویسی مناسب چاپ و وب، فرمت SVG/EPS.',
  })
  @IsOptional()
  @IsString()
  @Length(0, 550)
  seoDescription?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['وکتور', 'خوشنویسی', 'قلم سیاه'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Transform(toStringArray)
  seoKeywords?: string[];

  @ApiProperty({
    enum: PricingType,
    example: PricingType.PAID_OR_SUBSCRIPTION,
  })
  @IsEnum(PricingType)
  pricingType!: PricingType;

  @ApiPropertyOptional({
    description: 'قیمت نقدی (تومان). برای FREE/اشتراکی اختیاری است.',
    example: 49000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ enum: ProductStatus, example: ProductStatus.DRAFT })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({
    description: 'در صورت انتشار',
    example: '2025-11-08T12:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  publishedAt?: string;

  @ApiPropertyOptional({
    description: 'حجم فایل بر حسب مگابایت (برای فیلترهای کلاینت)',
    example: 120,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }

    const num = Number(value);
    if (Number.isNaN(num)) {
      return value;
    }

    return Math.round(num);
  })
  @IsInt()
  @Min(0)
  @Max(10000)
  fileSizeMB?: number;

  @ApiPropertyOptional({
    description: 'اندازه فایل به بایت (BigInt به صورت رشته)',
    example: '123456789',
  })
  @IsOptional()
  @Transform(toBigIntString)
  @IsString()
  fileBytes?: string;

  @ApiPropertyOptional({
    type: [ProductAssetInputDto],
    description: 'لیست دارایی‌های نمایشی محصول',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAssetInputDto)
  assets?: ProductAssetInputDto[];

  @ApiPropertyOptional({
    type: [ProductTopicLinkDto],
    description: 'تاپیک‌های مرتبط با محصول',
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
    description: 'نویسندگان محصول (UUID کاربران، حداکثر ۳ نفر)',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(3)
  @Transform(toStringArray)
  authorIds?: string[];
}
