import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CheckoutItemRequestDto } from './checkout-item.dto';

export class CheckoutConfirmRequestDto {
  @ApiProperty({ type: [CheckoutItemRequestDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemRequestDto)
  items!: CheckoutItemRequestDto[];

  @ApiPropertyOptional({ example: 'WELCOME10' })
  @IsOptional()
  couponCode?: string;

  @ApiProperty({ example: 'demo-request-123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  requestId!: string;
}
