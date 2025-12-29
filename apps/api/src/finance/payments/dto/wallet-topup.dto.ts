import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, Max, Min } from 'class-validator';
import {
  WALLET_TOPUP_MAX_AMOUNT,
  WALLET_TOPUP_MIN_AMOUNT,
} from '@app/finance/wallet/wallet.constants';

export class WalletTopupInitDto {
  @ApiProperty({ example: 200000 })
  @IsInt()
  @IsPositive()
  @Min(WALLET_TOPUP_MIN_AMOUNT)
  @Max(WALLET_TOPUP_MAX_AMOUNT)
  amount!: number;
}
