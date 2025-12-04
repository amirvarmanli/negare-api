import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ArtistHandleParamDto {
  @ApiProperty({
    example: 'amirhossein',
    description: 'Artist slug OR username',
  })
  @IsString()
  @IsNotEmpty()
  handle!: string;
}
