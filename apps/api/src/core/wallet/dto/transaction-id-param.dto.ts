import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class WalletTransactionIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id: string;
}
