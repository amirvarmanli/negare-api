import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CouponValueType } from '@app/finance/common/finance.enums';

export class DiscountListQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class DiscountCouponListQueryDto extends DiscountListQueryDto {
  @ApiPropertyOptional({ example: 'WELCOME10' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  q?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  includeDeleted?: boolean;
}

export class CreateDiscountCouponDto {
  @ApiProperty({ example: 'Yalda Sale' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 'YALDA20' })
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  code!: string;

  @ApiProperty({ enum: CouponValueType })
  @IsEnum(CouponValueType)
  valueType!: CouponValueType;

  @ApiProperty({ example: 15 })
  @IsInt()
  @Min(1)
  value!: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsage?: number;

  @ApiPropertyOptional({ example: 'Valid for new users only.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ example: '2026-01-10T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDiscountCouponDto extends PartialType(CreateDiscountCouponDto) {}

export class DiscountCouponDto {
  @ApiProperty({ example: 'coupon-uuid' })
  id!: string;

  @ApiProperty({ example: 'Yalda Sale' })
  title!: string;

  @ApiProperty({ example: 'YALDA20' })
  code!: string;

  @ApiProperty({ enum: CouponValueType })
  valueType!: CouponValueType;

  @ApiProperty({ example: 15 })
  value!: number;

  @ApiPropertyOptional({ example: 100 })
  maxUsage?: number | null;

  @ApiProperty({ example: 0 })
  usedCount!: number;

  @ApiPropertyOptional({ example: 'Valid for new users only.' })
  note?: string | null;

  @ApiPropertyOptional()
  expiresAt?: string | null;

  @ApiPropertyOptional()
  deletedAt?: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-01-02T00:00:00.000Z' })
  updatedAt!: string;
}

export class PaginatedDiscountCouponsDto {
  @ApiProperty({ type: [DiscountCouponDto] })
  data!: DiscountCouponDto[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: false })
  hasNext!: boolean;
}
