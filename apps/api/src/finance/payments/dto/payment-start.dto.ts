import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaymentReferenceType } from '@app/finance/common/finance.enums';

export class PaymentStartDto {
  @ApiProperty({
    enum: PaymentReferenceType,
    example: PaymentReferenceType.SUBSCRIPTION,
  })
  @IsEnum(PaymentReferenceType)
  refType!: PaymentReferenceType;

  @ApiProperty({ example: 'purchase-or-wallet-reference-id' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  refId?: string;

  @ApiPropertyOptional({ example: 200000 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  amount?: number;
}

export class PaymentStartResponseDto {
  @ApiProperty({ example: 'payment-uuid' })
  paymentId!: string;

  @ApiPropertyOptional({ example: 'donation-uuid' })
  donationId?: string;

  @ApiProperty({ example: 'https://gateway.zibal.ir/start/123456' })
  redirectUrl!: string;

  @ApiProperty({ example: '123456' })
  trackId!: string;
}
