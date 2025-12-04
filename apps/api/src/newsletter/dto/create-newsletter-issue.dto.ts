import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublicationStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
} from 'class-validator';

export class CreateNewsletterIssueDto {
  @ApiProperty({ minLength: 3, maxLength: 255 })
  @IsString()
  @Length(3, 255)
  title!: string;

  @ApiPropertyOptional({ minLength: 2, maxLength: 255 })
  @IsOptional()
  @IsString()
  @Length(2, 255)
  slug?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 20000)
  content!: string;

  @ApiPropertyOptional({ maxLength: 600 })
  @IsOptional()
  @IsString()
  @Length(3, 600)
  excerpt?: string;

  @ApiPropertyOptional({
    description: 'Cover image url',
  })
  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @ApiPropertyOptional({
    description: 'Optional downloadable file URL',
  })
  @IsOptional()
  @IsUrl()
  fileUrl?: string;

  @ApiProperty({ description: 'Category id (UUID)' })
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({ enum: PublicationStatus })
  @IsOptional()
  @IsEnum(PublicationStatus)
  status?: PublicationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: 'Pin this issue to the top' })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}
