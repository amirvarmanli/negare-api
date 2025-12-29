import { ApiProperty } from '@nestjs/swagger';

export class DonationInitResponseDto {
  @ApiProperty({ example: 'donation-uuid' })
  donationId!: string;

  @ApiProperty({ example: 'payment-uuid' })
  paymentId!: string;

  @ApiProperty({ example: 'track-id' })
  trackId!: string;

  @ApiProperty({ example: 'https://gateway.example.com/pay/track-id' })
  redirectUrl!: string;

  @ApiProperty({ example: 50000 })
  amount!: number;
}
