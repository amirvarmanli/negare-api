import { ApiProperty } from '@nestjs/swagger';
import { PublicationStatus } from '@prisma/client';
import { NewsletterAuthorDto } from '@app/newsletter/dto/newsletter-author.dto';
import { NewsletterCategoryDto } from '@app/newsletter/dto/newsletter-category.dto';

export class NewsletterAdminListItemDto {
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

  @ApiProperty({ type: () => NewsletterAuthorDto })
  author!: NewsletterAuthorDto;

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
