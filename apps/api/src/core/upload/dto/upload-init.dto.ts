import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class UploadInitDto {
  @ApiProperty({
    description: 'Original filename (used to derive the final stored name)',
    example: 'profile-picture.png',
  })
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @ApiProperty({
    description: 'Total file size in bytes',
    example: 7340032,
  })
  @IsInt()
  @Min(1)
  size!: number;

  @ApiPropertyOptional({
    description: 'Client-reported MIME type (validated server-side)',
    example: 'image/png',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  mime?: string | null;

  @ApiPropertyOptional({
    description:
      'Optional final-file SHA-256 checksum (hex). When integrity mode is required, the server enforces it.',
    example: '7b502c3a1f48c8609ae212cdfb639dee39673f5e3e593ef1bdc5274f',
    minLength: 64,
    maxLength: 64,
  })
  @IsOptional()
  @Matches(/^[a-f0-9]{64}$/i, {
    message: 'sha256 must be a 64-length hex string',
  })
  sha256?: string;
}
