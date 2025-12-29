import { ApiProperty } from '@nestjs/swagger';

export class PaymentInitResponseDto {
  @ApiProperty({ example: 'payment-uuid' })
  paymentId!: string;

  @ApiProperty({
    example: '123456',
    description: 'Zibal trackId returned by the request API.',
  })
  trackId!: string;

  @ApiProperty({
    example: '123456',
    description: 'Legacy field; same as trackId for Zibal.',
  })
  authority!: string;

  @ApiProperty({
    example: 'https://gateway.zibal.ir/start/123456',
    description: 'Redirect the user to this URL to continue payment.',
  })
  gatewayUrl!: string;

  @ApiProperty({ example: 250000 })
  amount!: number;
}
