import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ZibalCallbackQueryDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  trackId!: string;

  @ApiProperty({ required: false, description: 'Gateway success flag if provided.' })
  @IsOptional()
  @IsString()
  success?: string;

  @ApiProperty({ required: false, description: 'Gateway status if provided.' })
  @IsOptional()
  @IsString()
  status?: string;
}
