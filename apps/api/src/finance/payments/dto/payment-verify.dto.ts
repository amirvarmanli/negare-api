import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class PaymentVerifyDto {
  @ApiProperty({ example: 'payment-uuid' })
  @IsString()
  @MaxLength(64)
  paymentId!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  success!: boolean;

  @ApiProperty({
    example: 'mock_12345',
    required: false,
    description: 'Mock gateway authority/trackId (legacy).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  authority?: string;

  @ApiProperty({ example: 'ref_123', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  refId?: string;
}
