import { ApiProperty } from '@nestjs/swagger';
import { DonationStatus } from '@app/finance/common/finance.enums';

export class DonationResultDto {
  @ApiProperty({ example: 50000 })
  amount!: number;

  @ApiProperty({ enum: DonationStatus })
  status!: DonationStatus;

  @ApiProperty({ example: 'Thank you for your support.' })
  message!: string;

  @ApiProperty({ example: 'ref_123', nullable: true })
  referenceId!: string | null;
}
