import { ApiProperty } from '@nestjs/swagger';
import { CommentStatus } from '@prisma/client';
import { PaginationMetaDto } from '@app/common/dto/pagination.dto';
import { NewsletterAuthorDto } from '@app/newsletter/dto/newsletter-author.dto';

export class NewsletterIssueSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  slug!: string;
}

export class NewsletterCommentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ enum: CommentStatus })
  status!: CommentStatus;

  @ApiProperty({ required: false, nullable: true })
  parentId!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: () => NewsletterAuthorDto })
  author!: NewsletterAuthorDto;

  @ApiProperty({ type: () => NewsletterIssueSummaryDto, required: false })
  issue?: NewsletterIssueSummaryDto;

  @ApiProperty({ type: () => [NewsletterCommentDto], required: false })
  replies?: NewsletterCommentDto[];
}

export class NewsletterCommentListResponseDto {
  @ApiProperty({ type: () => [NewsletterCommentDto] })
  items!: NewsletterCommentDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
