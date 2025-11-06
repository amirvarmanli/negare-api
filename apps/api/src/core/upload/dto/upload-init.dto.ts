import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

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
}
