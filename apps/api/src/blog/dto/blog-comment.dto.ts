import { ApiProperty } from '@nestjs/swagger';
import { CommentStatus } from '@prisma/client';
import { PaginationMetaDto } from '@app/common/dto/pagination.dto';
import { AuthorSummaryDto } from '@app/blog/dto/author-summary.dto';

export class BlogPostSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  slug!: string;
}

export class BlogCommentDto {
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

  @ApiProperty({ type: () => AuthorSummaryDto })
  author!: AuthorSummaryDto;

  @ApiProperty({ type: () => BlogPostSummaryDto, required: false })
  post?: BlogPostSummaryDto;

  @ApiProperty({ type: () => [BlogCommentDto], required: false })
  replies?: BlogCommentDto[];
}

export class BlogCommentListResponseDto {
  @ApiProperty({ type: () => [BlogCommentDto] })
  items!: BlogCommentDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
