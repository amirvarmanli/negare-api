import { ApiProperty } from '@nestjs/swagger';
import { PublicationStatus } from '@prisma/client';
import { PaginationMetaDto } from '@app/common/dto/pagination.dto';
import { NewsletterCategoryDto } from '@app/newsletter/dto/newsletter-category.dto';
import { NewsletterCommentDto } from '@app/newsletter/dto/newsletter-comment.dto';
import { NewsletterAuthorDto } from '@app/newsletter/dto/newsletter-author.dto';

export class NewsletterIssueDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ required: false, nullable: true, description: 'Short summary used by the frontend.' })
  summary!: string | null;

  @ApiProperty({ required: false, nullable: true })
  excerpt!: string | null;

  @ApiProperty()
  content!: string;

  @ApiProperty({ required: false, nullable: true })
  coverImageUrl!: string | null;

  @ApiProperty({ required: false, nullable: true })
  fileUrl!: string | null;

  @ApiProperty({ enum: PublicationStatus })
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
  commentCount!: number;

  @ApiProperty()
  isPinned!: boolean;

  @ApiProperty({ type: () => NewsletterCategoryDto })
  category!: NewsletterCategoryDto;

  @ApiProperty({ type: () => NewsletterAuthorDto })
  author!: NewsletterAuthorDto;

  @ApiProperty({ type: () => [NewsletterCommentDto], required: false })
  comments?: NewsletterCommentDto[];
}

export class NewsletterIssueListResponseDto {
  @ApiProperty({ type: () => [NewsletterIssueDto] })
  items!: NewsletterIssueDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
