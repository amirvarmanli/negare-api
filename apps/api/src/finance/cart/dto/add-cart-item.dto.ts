import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({ example: '1024' })
  @IsString()
  @MaxLength(32)
  productId!: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  qty?: number;
}
