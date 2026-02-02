import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CheckoutItemRequestDto } from './checkout-item.dto';

export class CheckoutPriceQuoteRequestDto {
  @ApiProperty({ type: [CheckoutItemRequestDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemRequestDto)
  items!: CheckoutItemRequestDto[];

  @ApiPropertyOptional({ example: 'WELCOME10' })
  @IsOptional()
  couponCode?: string;
}
