import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { WalletCurrency } from '../wallet.entity';

export class CreateWalletDto {
  @ApiPropertyOptional({ enum: WalletCurrency, default: WalletCurrency.IRR })
  @IsOptional()
  @IsEnum(WalletCurrency)
  currency?: WalletCurrency;
}
