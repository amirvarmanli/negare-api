import { ApiProperty } from '@nestjs/swagger';
import { PublicationStatus } from '@prisma/client';
import { AuthorSummaryDto } from '@app/blog/dto/author-summary.dto';
import { BlogCategoryDto } from '@app/blog/dto/blog-category.dto';

export class BlogAdminListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ enum: PublicationStatus })
  status!: PublicationStatus;

  @ApiProperty({ required: false, nullable: true })
  publishedAt!: Date | null;

  @ApiProperty({ required: false, nullable: true })
  archivedAt!: Date | null;

  @ApiProperty({ required: false, nullable: true })
  reviewedAt!: Date | null;

  @ApiProperty({ required: false, nullable: true })
  reviewedByAdminId!: string | null;

  @ApiProperty({ required: false, nullable: true })
  rejectReason!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: () => AuthorSummaryDto })
  author!: AuthorSummaryDto;

  @ApiProperty({ type: () => BlogCategoryDto })
  category!: BlogCategoryDto;
}

export class BlogAdminListMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class BlogAdminListResponseDto {
  @ApiProperty({ type: () => [BlogAdminListItemDto] })
  items!: BlogAdminListItemDto[];

  @ApiProperty({ type: () => BlogAdminListMetaDto })
  meta!: BlogAdminListMetaDto;
}
