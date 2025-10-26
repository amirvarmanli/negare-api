import { ApiProperty } from '@nestjs/swagger';
import { WalletCurrency } from '../wallet.entity';

export class WalletBalanceDto {
  @ApiProperty({ example: '250000' })
  balance: string;

  @ApiProperty({ enum: WalletCurrency, example: WalletCurrency.IRR })
  currency: WalletCurrency;
}
