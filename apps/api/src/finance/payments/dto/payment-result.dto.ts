import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentPurpose, PaymentStatus } from '@app/finance/common/finance.enums';

export class PaymentResultDto {
  @ApiProperty({ enum: PaymentPurpose })
  purpose!: PaymentPurpose;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ example: 250000 })
  amountToman!: number;

  @ApiProperty({ example: 'پرداخت با موفقیت انجام شد.' })
  messageFa!: string;

  @ApiPropertyOptional({ example: 'order-uuid' })
  orderId?: string | null;

  @ApiPropertyOptional({ example: true })
  canAccessDownloads?: boolean;

  @ApiPropertyOptional({ example: 500000 })
  walletBalanceToman?: number;

  @ApiPropertyOptional({ example: 200000 })
  topupAmountToman?: number;
}
