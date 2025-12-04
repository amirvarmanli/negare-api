import { ApiProperty } from '@nestjs/swagger';
import { PublicationStatus } from '@prisma/client';
import { PaginationMetaDto } from '@app/common/dto/pagination.dto';
import { BlogCategoryDto } from '@app/blog/dto/blog-category.dto';
import { BlogCommentDto } from '@app/blog/dto/blog-comment.dto';
import { AuthorSummaryDto } from '@app/blog/dto/author-summary.dto';

export class BlogPostDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ required: false, nullable: true })
  excerpt!: string | null;

  @ApiProperty()
  content!: string;

  @ApiProperty({ required: false, nullable: true })
  coverImageUrl!: string | null;

  @ApiProperty({ enum: PublicationStatus, default: PublicationStatus.DRAFT })
  status!: PublicationStatus;

  @ApiProperty({ required: false, nullable: true })
  publishedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  viewCount!: number;

  @ApiProperty()
  isFeatured!: boolean;

  @ApiProperty()
  isPinned!: boolean;

  @ApiProperty()
  commentCount!: number;

  @ApiProperty({ type: () => BlogCategoryDto })
  category!: BlogCategoryDto;

  @ApiProperty({ type: () => AuthorSummaryDto })
  author!: AuthorSummaryDto;

  @ApiProperty({ type: () => [BlogCommentDto], required: false })
  comments?: BlogCommentDto[];
}

export class BlogPostListResponseDto {
  @ApiProperty({ type: () => [BlogPostDto] })
  items!: BlogPostDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
