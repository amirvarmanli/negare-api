import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

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

  @ApiPropertyOptional({
    description:
      'Optional final-file SHA-256 checksum (hex). Required when integrity.fileHash mode is "required".',
    example: '7b502c3a1f48c8609ae212cdfb639dee39673f5e3e593ef1bdc5274f',
  })
  @IsOptional()
  @Matches(/^[a-f0-9]{64}$/i, {
    message: 'sha256 must be a 64-length hex string',
  })
  sha256?: string;
}
