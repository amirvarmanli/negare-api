import { ApiPropertyOptional } from '@nestjs/swagger';
import { PublicationStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';

export class AdminUpdateBlogDto {
  @ApiPropertyOptional({ minLength: 3, maxLength: 255 })
  @IsOptional()
  @IsString()
  @Length(3, 255)
  title?: string;

  @ApiPropertyOptional({ minLength: 2, maxLength: 255 })
  @IsOptional()
  @IsString()
  @Length(2, 255)
  slug?: string;

  @ApiPropertyOptional({ maxLength: 70, description: 'SEO browser title' })
  @IsOptional()
  @IsString()
  @Length(2, 70)
  browserTitle?: string;

  @ApiPropertyOptional({ maxLength: 600 })
  @IsOptional()
  @IsString()
  @Length(3, 600)
  excerpt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 20000)
  content?: string;

  @ApiPropertyOptional({ description: 'Cover image URL' })
  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @ApiPropertyOptional({ description: 'Preview cover image URL' })
  @IsOptional()
  @IsUrl()
  previewCoverUrl?: string;

  @ApiPropertyOptional({
    enum: [
      PublicationStatus.DRAFT,
      PublicationStatus.PUBLISHED,
      PublicationStatus.ARCHIVED,
    ],
    description: 'Admin panel status (DRAFT | PUBLISHED | ARCHIVED)',
  })
  @IsOptional()
  @IsEnum(PublicationStatus)
  status?: PublicationStatus;

  @ApiPropertyOptional({ description: 'Optional publish schedule ISO date' })
  @IsOptional()
  @IsDateString()
  publishedAt?: string;
}
