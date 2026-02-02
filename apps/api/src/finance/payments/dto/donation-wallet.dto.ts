import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import {
  PaymentFulfillmentStatus,
  PaymentStatus,
} from '@app/finance/common/finance.enums';
import {
  DONATION_MAX_AMOUNT,
  DONATION_MIN_AMOUNT,
} from '@app/finance/donations/donations.constants';

export class DonationWalletPayDto {
  @ApiProperty({ example: 200000 })
  @IsInt()
  @Min(DONATION_MIN_AMOUNT)
  @Max(DONATION_MAX_AMOUNT)
  amount!: number;

  @ApiProperty({
    example: 'donation-req-123',
    description: 'Client-provided idempotency key to prevent duplicate wallet debits.',
  })
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}

export class DonationWalletPayResponseDto {
  @ApiProperty({ example: 'donation-uuid' })
  donationId!: string;

  @ApiProperty({ example: 'payment-uuid' })
  paymentId!: string;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ enum: PaymentFulfillmentStatus })
  fulfillmentStatus!: PaymentFulfillmentStatus;

  @ApiProperty({ example: 150000 })
  newBalance!: number;
}
