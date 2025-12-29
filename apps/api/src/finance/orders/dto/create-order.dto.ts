import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DiscountType } from '@app/finance/common/finance.enums';

export class CreateOrderItemDto {
  @ApiProperty({ example: '1024' })
  @IsString()
  @MaxLength(32)
  productId!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(10)
  quantity!: number;
}

export class DiscountInputDto {
  @ApiProperty({
    enum: DiscountType,
    example: DiscountType.FIXED,
    description: 'Deprecated: use couponCode instead.',
  })
  @IsEnum(DiscountType)
  type!: DiscountType;

  @ApiProperty({
    example: 50000,
    description: 'Deprecated: use couponCode instead.',
  })
  @IsInt()
  @IsPositive()
  value!: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @ApiPropertyOptional({ type: DiscountInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DiscountInputDto)
  discount?: DiscountInputDto;

  @ApiPropertyOptional({ example: 'WELCOME10' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  couponCode?: string;
}
