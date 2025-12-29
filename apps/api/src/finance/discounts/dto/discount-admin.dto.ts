import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';
import { DiscountValueType } from '@app/finance/common/finance.enums';

export class DiscountListQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  limit?: number;
}

export class CreateProductDiscountDto {
  @ApiProperty({ example: '1024' })
  @IsString()
  @MaxLength(32)
  productId!: string;

  @ApiProperty({ enum: DiscountValueType })
  @IsEnum(DiscountValueType)
  type!: DiscountValueType;

  @ApiProperty({ example: 10, description: 'Fixed amount or percent value.' })
  @IsInt()
  @IsPositive()
  @Max(1_000_000)
  value!: number;

  @ApiPropertyOptional({ example: '2024-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2024-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateUserDiscountDto {
  @ApiProperty({ example: 'user-uuid' })
  @IsString()
  @MaxLength(64)
  userId!: string;

  @ApiProperty({ enum: DiscountValueType })
  @IsEnum(DiscountValueType)
  type!: DiscountValueType;

  @ApiProperty({ example: 15 })
  @IsInt()
  @IsPositive()
  @Max(100)
  value!: number;

  @ApiPropertyOptional({ example: '2024-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2024-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateCouponDto {
  @ApiProperty({ example: 'WELCOME10' })
  @IsString()
  @MaxLength(64)
  code!: string;

  @ApiProperty({ enum: DiscountValueType })
  @IsEnum(DiscountValueType)
  type!: DiscountValueType;

  @ApiProperty({ example: 10 })
  @IsInt()
  @IsPositive()
  @Max(1_000_000)
  value!: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  maxUsage?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  maxUsagePerUser?: number;

  @ApiPropertyOptional({ example: '2024-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ProductDiscountDto {
  @ApiProperty({ example: 'discount-uuid' })
  id!: string;

  @ApiProperty({ example: '1024' })
  productId!: string;

  @ApiProperty({ enum: DiscountValueType })
  type!: DiscountValueType;

  @ApiProperty({ example: 10 })
  value!: number;

  @ApiPropertyOptional()
  startsAt?: string | null;

  @ApiPropertyOptional()
  endsAt?: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class UserDiscountDto {
  @ApiProperty({ example: 'discount-uuid' })
  id!: string;

  @ApiProperty({ example: 'user-uuid' })
  userId!: string;

  @ApiProperty({ enum: DiscountValueType })
  type!: DiscountValueType;

  @ApiProperty({ example: 15 })
  value!: number;

  @ApiPropertyOptional()
  startsAt?: string | null;

  @ApiPropertyOptional()
  endsAt?: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class CouponDto {
  @ApiProperty({ example: 'coupon-uuid' })
  id!: string;

  @ApiProperty({ example: 'WELCOME10' })
  code!: string;

  @ApiProperty({ enum: DiscountValueType })
  type!: DiscountValueType;

  @ApiProperty({ example: 10 })
  value!: number;

  @ApiPropertyOptional({ example: 100 })
  maxUsage?: number | null;

  @ApiPropertyOptional({ example: 1 })
  maxUsagePerUser?: number | null;

  @ApiPropertyOptional()
  expiresAt?: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class PaginatedProductDiscountsDto {
  @ApiProperty({ type: [ProductDiscountDto] })
  data!: ProductDiscountDto[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: false })
  hasNext!: boolean;
}

export class PaginatedUserDiscountsDto {
  @ApiProperty({ type: [UserDiscountDto] })
  data!: UserDiscountDto[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: false })
  hasNext!: boolean;
}

export class PaginatedCouponsDto {
  @ApiProperty({ type: [CouponDto] })
  data!: CouponDto[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: false })
  hasNext!: boolean;
}
