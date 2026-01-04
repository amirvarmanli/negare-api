import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SubscriptionDownloadRequestDto {
  @ApiProperty({ example: '1024' })
  @IsString()
  productId!: string;
}
