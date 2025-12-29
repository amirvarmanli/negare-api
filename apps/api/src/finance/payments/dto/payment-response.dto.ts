import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus, PaymentProvider } from '@app/finance/common/finance.enums';

export class PaymentResponseDto {
  @ApiProperty({ example: 'payment-uuid' })
  id!: string;

  @ApiProperty({ enum: PaymentProvider })
  provider!: PaymentProvider;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ example: 250000 })
  amount!: number;

  @ApiProperty({ example: '123456', nullable: true })
  trackId!: string | null;

  @ApiProperty({
    example: '123456',
    nullable: true,
    description: 'Legacy field; equals trackId for Zibal.',
  })
  authority!: string | null;

  @ApiProperty({ example: 'ref_123', nullable: true })
  refId!: string | null;
}
