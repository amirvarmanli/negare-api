import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductFileResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the stored product file.',
    example: '123',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'Original filename provided during upload.',
    example: 'minimalist-ui-kit.zip',
  })
  originalName?: string | null;

  @ApiPropertyOptional({
    description: 'File size in bytes.',
    example: 1048576,
  })
  size?: number;

  @ApiPropertyOptional({
    description: 'Detected MIME type for the uploaded file.',
    example: 'application/zip',
  })
  mimeType?: string | null;

  @ApiProperty({
    description: 'Upload timestamp in ISO 8601 format.',
    example: '2024-05-01T10:00:00.000Z',
  })
  createdAt: Date;
}
