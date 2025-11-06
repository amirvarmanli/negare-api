import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UploadFinishDto {
  @ApiProperty({
    description: 'Upload session identifier returned from /upload/init',
    example: 'b1f8e7a0-7e2d-4c3f-8f2b-0f1e9f8a1c2d',
  })
  @IsUUID()
  uploadId!: string;

  @ApiPropertyOptional({
    description:
      'Optional sub-directory within the storage root to place the file',
    example: 'avatars',
  })
  @IsOptional()
  @IsString()
  subdir?: string;
}
