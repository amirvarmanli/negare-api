import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import {
  PaymentReferenceType,
  PaymentStatus,
} from '@app/finance/common/finance.enums';

export class PaymentVerifyRequestDto {
  @ApiProperty({ example: 'payment-uuid' })
  @IsString()
  @MaxLength(64)
  paymentId!: string;
}

export class PaymentStatusResponseDto {
  @ApiProperty({ example: 'payment-uuid' })
  paymentId!: string;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ example: 250000 })
  amount!: number;

  @ApiProperty({ example: '123456', nullable: true })
  trackId!: string | null;

  @ApiProperty({ enum: PaymentReferenceType, nullable: true })
  refType!: PaymentReferenceType | null;

  @ApiProperty({ example: 'cart-or-purchase-id', nullable: true })
  refId!: string | null;
}
