import { ApiPropertyOptional } from '@nestjs/swagger';
import { PublicationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export enum AdminBlogSortBy {
  createdAt = 'createdAt',
  updatedAt = 'updatedAt',
  publishedAt = 'publishedAt',
}

export enum AdminBlogSortOrder {
  asc = 'asc',
  desc = 'desc',
}

export class AdminBlogsListQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Search in title, slug, and author name fields',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    enum: [
      PublicationStatus.DRAFT,
      PublicationStatus.PUBLISHED,
      PublicationStatus.ARCHIVED,
    ],
    description: 'Admin panel status filter (DRAFT | PUBLISHED | ARCHIVED)',
  })
  @IsOptional()
  @IsEnum(PublicationStatus)
  status?: PublicationStatus;

  @ApiPropertyOptional({ description: 'Filter by author id (UUID)' })
  @IsOptional()
  @IsUUID()
  authorId?: string;

  @ApiPropertyOptional({ description: 'Filter from createdAt (ISO date)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Filter to createdAt (ISO date)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: AdminBlogSortBy, default: AdminBlogSortBy.createdAt })
  @IsOptional()
  @IsEnum(AdminBlogSortBy)
  sort?: AdminBlogSortBy;

  @ApiPropertyOptional({ enum: AdminBlogSortOrder, default: AdminBlogSortOrder.desc })
  @IsOptional()
  @IsEnum(AdminBlogSortOrder)
  order?: AdminBlogSortOrder;
}
