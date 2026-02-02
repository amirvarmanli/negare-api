import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { toTrimmedString } from '@app/catalog/product/dtos/transformers';

export enum AdminPurchasePaymentStatus {
  SUCCESS = 'SUCCESS',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
}

export class AdminOrdersQueryDto {
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

  @ApiPropertyOptional({ enum: AdminPurchasePaymentStatus })
  @IsOptional()
  @IsEnum(AdminPurchasePaymentStatus)
  status?: AdminPurchasePaymentStatus;

  @ApiPropertyOptional({
    description: 'Search by buyer name/phone/email or order/payment identifiers.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(toTrimmedString)
  q?: string;

  @ApiPropertyOptional({ description: 'Filter from createdAt (ISO date)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Filter to createdAt (ISO date)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
