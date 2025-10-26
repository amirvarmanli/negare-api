import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class WalletUserIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  userId: string;
}
