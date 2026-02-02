import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class CheckoutItemRequestDto {
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

export class CheckoutItemResponseDto {
  @ApiProperty({ example: '1024' })
  productId!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ example: 120000 })
  unitPrice!: number;

  @ApiProperty({ example: 240000 })
  lineTotal!: number;
}
