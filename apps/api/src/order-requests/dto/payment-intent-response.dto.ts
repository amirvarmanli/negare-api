import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';

export class PaymentIntentResponseDto {
  @ApiProperty({ example: 'payment-uuid' })
  paymentId!: string;

  @ApiProperty({ example: '123456' })
  trackId!: string | null;

  @ApiProperty({ example: 'https://gateway.zibal.ir/start/123456' })
  redirectUrl!: string | null;

  @ApiProperty({ example: 2100000 })
  amountToman!: number;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;
}
