import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Min,
  ValidateIf,
} from 'class-validator';
import { toBigIntString, toTrimmedString } from '@app/catalog/product/dtos/transformers';

export class ProductAssetInputDto {
  @ApiProperty({
    description: 'Publicly accessible URL of the asset',
    example: 'https://cdn.negare.test/products/hero.svg',
  })
  @IsUrl()
  url!: string;

  @ApiPropertyOptional({
    description: 'Optional alt text (used for accessibility)',
    example: 'Preview of the hero illustration',
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  @Transform(toTrimmedString)
  alt?: string;

  @ApiPropertyOptional({
    description: 'Explicit sort order (defaults to array index)',
    minimum: 0,
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
}

export class ProductTopicLinkDto {
  @ApiProperty({
    description: 'Topic ID (BigInt as string)',
    example: '42',
  })
  // ← ورودی را به رشته تبدیل کن (مثلاً اگر 42 عددی آمده)
  @Transform(toBigIntString)
  // ← فقط ارقام مجازند (بدون فاصله/علامت)
  @IsNumberString(
    { no_symbols: true },
    { message: 'topicId must be a numeric string' },
  )
  topicId!: string;

  @ApiPropertyOptional({
    description: 'Optional ordering for the topic (default: 0)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
}

export class ProductFileInputDto {
  @ApiProperty({
    description: 'Storage key (returned from the upload service)',
    example: 'products/2025/01/hero-pack.zip',
  })
  @Transform(toTrimmedString)
  @IsString()
  @Length(3, 255)
  storageKey!: string;

  @ApiPropertyOptional({
    description: 'Original filename as uploaded by the author',
    example: 'hero-pack.zip',
  })
  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  @Length(1, 255)
  originalName?: string;

  @ApiPropertyOptional({
    description: 'File size in bytes (stringified BigInt)',
    example: '123456789',
  })
  @IsOptional()
  @Transform(toBigIntString)
  @IsNumberString(
    { no_symbols: true },
    { message: 'size must be a numeric string' },
  )
  size?: string;

  @ApiPropertyOptional({
    description: 'Detected/declared MIME type',
    example: 'application/zip',
  })
  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  @Length(3, 255)
  mimeType?: string;

  @ApiPropertyOptional({
    description: 'Arbitrary JSON metadata saved with the file',
    type: Object,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsObject()
  meta?: Record<string, unknown> | null;
}
