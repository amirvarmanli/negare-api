import { ApiProperty } from '@nestjs/swagger';

export enum WalletCurrencyDto {
  TOMAN = 'TOMAN',
}

export class WalletBalanceResponseDto {
  @ApiProperty({ example: 250000 })
  balance!: number;

  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED'], example: 'ACTIVE' })
  status!: 'ACTIVE' | 'SUSPENDED';

  @ApiProperty({ enum: WalletCurrencyDto, example: WalletCurrencyDto.TOMAN })
  currency!: WalletCurrencyDto;

  @ApiProperty({ example: '2025-01-01T12:00:00.000Z' })
  updatedAt!: string;
}
