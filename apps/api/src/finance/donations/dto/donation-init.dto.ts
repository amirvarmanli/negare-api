import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, Max, Min } from 'class-validator';
import {
  DONATION_MAX_AMOUNT,
  DONATION_MIN_AMOUNT,
} from '@app/finance/donations/donations.constants';

export class DonationInitDto {
  @ApiProperty({ example: 50000 })
  @IsInt()
  @IsPositive()
  @Min(DONATION_MIN_AMOUNT)
  @Max(DONATION_MAX_AMOUNT)
  amount!: number;
}
