import { ApiProperty } from '@nestjs/swagger';
import { PublicationStatus } from '@prisma/client';
import { NewsletterAdminAuthorDto } from '@app/newsletter/dto/admin-author.dto';
import { NewsletterCategoryDto } from '@app/newsletter/dto/newsletter-category.dto';

export class NewsletterAdminListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ required: false, nullable: true })
  coverImageUrl!: string | null;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ required: false, nullable: true })
  excerpt!: string | null;

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

  @ApiProperty({ type: () => NewsletterAdminAuthorDto })
  author!: NewsletterAdminAuthorDto;

  @ApiProperty({ type: () => NewsletterCategoryDto })
  category!: NewsletterCategoryDto;
}

export class NewsletterAdminListMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class NewsletterAdminListResponseDto {
  @ApiProperty({ type: () => [NewsletterAdminListItemDto] })
  items!: NewsletterAdminListItemDto[];

  @ApiProperty({ type: () => NewsletterAdminListMetaDto })
  meta!: NewsletterAdminListMetaDto;
}
