import { ApiProperty } from '@nestjs/swagger';
import { PublicationStatus } from '@prisma/client';
import { BlogAdminAuthorDto } from '@app/blog/dto/admin-author.dto';
import { BlogCategoryDto } from '@app/blog/dto/blog-category.dto';

export class BlogAdminDetailDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ required: false, nullable: true })
  browserTitle!: string | null;

  @ApiProperty({ required: false, nullable: true })
  excerpt!: string | null;

  @ApiProperty()
  content!: string;

  @ApiProperty({ required: false, nullable: true })
  coverImageUrl!: string | null;

  @ApiProperty({ required: false, nullable: true })
  previewCoverUrl!: string | null;

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

  @ApiProperty()
  isFeatured!: boolean;

  @ApiProperty()
  isPinned!: boolean;

  @ApiProperty()
  viewCount!: number;

  @ApiProperty()
  commentCount!: number;

  @ApiProperty({ type: () => BlogCategoryDto })
  category!: BlogCategoryDto;

  @ApiProperty({ type: () => BlogAdminAuthorDto })
  author!: BlogAdminAuthorDto;
}
