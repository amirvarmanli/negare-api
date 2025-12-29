import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { PayoutStatus } from '@app/finance/common/finance.enums';

export class PayoutComputeDto {
  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional({ example: '2024-01-31' })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}

export class PayoutMarkPaidDto {
  @ApiPropertyOptional({ example: 'bank-ref-123' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  reference?: string;
}

export class SupplierPayoutDto {
  @ApiProperty({ example: 'payout-uuid' })
  id!: string;

  @ApiProperty({ example: 'supplier-uuid' })
  supplierId!: string;

  @ApiProperty({ example: 250000 })
  amount!: number;

  @ApiPropertyOptional({ example: '2024-01-01' })
  periodStart?: string | null;

  @ApiPropertyOptional({ example: '2024-01-31' })
  periodEnd?: string | null;

  @ApiProperty({ enum: PayoutStatus })
  status!: PayoutStatus;

  @ApiPropertyOptional({ example: 'bank-ref-123' })
  reference?: string | null;
}

export class PayoutComputeResponseDto {
  @ApiProperty({ type: [SupplierPayoutDto] })
  payouts!: SupplierPayoutDto[];
}
