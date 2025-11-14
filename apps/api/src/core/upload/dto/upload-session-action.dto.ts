import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UploadSessionActionDto {
  @ApiProperty({
    description: 'Upload session identifier returned from /upload/init',
  })
  @IsUUID()
  uploadId!: string;
}

