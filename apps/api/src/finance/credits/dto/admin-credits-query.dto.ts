import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { toTrimmedString } from '@app/catalog/product/dtos/transformers';

export enum AdminCreditType {
  PRODUCT_PURCHASE = 'PRODUCT_PURCHASE',
  SUBSCRIPTION_PURCHASE = 'SUBSCRIPTION_PURCHASE',
}

export class AdminCreditsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: AdminCreditType })
  @IsOptional()
  @IsEnum(AdminCreditType)
  type?: AdminCreditType;

  @ApiPropertyOptional({
    description:
      'Search by supplier name/phone/email, product title, or subscription pool period label.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(toTrimmedString)
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by supplier user id (UUID).' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Filter from createdAt (ISO date)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Filter to createdAt (ISO date)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
