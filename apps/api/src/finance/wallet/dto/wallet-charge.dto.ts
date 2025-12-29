import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, Max, Min } from 'class-validator';
import {
  WALLET_TOPUP_MAX_AMOUNT,
  WALLET_TOPUP_MIN_AMOUNT,
} from '@app/finance/wallet/wallet.constants';

export class WalletChargeDto {
  @ApiProperty({ example: 200000 })
  @IsInt()
  @IsPositive()
  @Min(WALLET_TOPUP_MIN_AMOUNT)
  @Max(WALLET_TOPUP_MAX_AMOUNT)
  amount!: number;
}

export class WalletChargeResponseDto {
  @ApiProperty({ example: 'payment-uuid' })
  paymentId!: string;

  @ApiProperty({ example: 'https://gateway.zibal.ir/start/123456' })
  redirectUrl!: string;

  @ApiProperty({ example: '123456' })
  trackId!: string;
}
