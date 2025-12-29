import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsNumberString } from 'class-validator';

export class ZibalCallbackQueryDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @MaxLength(128)
  trackId!: string;

  @ApiProperty({ example: '1', required: false })
  @IsOptional()
  @IsNumberString()
  @MaxLength(8)
  success?: string;

  @ApiProperty({ example: '2', required: false })
  @IsOptional()
  @IsNumberString()
  @MaxLength(8)
  status?: string;

  @ApiProperty({
    example: 'b6c9a54d-0df7-4b7e-86d6-fd4c4f1a9b2a',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  orderId?: string;
}
