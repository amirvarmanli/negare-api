import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ArtistIdParamDto {
  @ApiProperty({ format: 'uuid', description: 'Artist user id' })
  @IsUUID()
  id!: string;
}
