import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';

export class AdminProductCategoryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;
}

export class AdminProductTopicDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;
}

export class AdminProductArtistDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl?: string | null;
}

export class AdminProductListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ enum: ProductStatus })
  publishStatus!: ProductStatus;

  @ApiPropertyOptional({ nullable: true })
  pinnedAt?: string | null;

  @ApiProperty({
    enum: ['FREE', 'PAID', 'SUBSCRIPTION'],
  })
  saleType!: 'FREE' | 'PAID' | 'SUBSCRIPTION';

  @ApiPropertyOptional({ nullable: true })
  price?: number | null;

  @ApiPropertyOptional({ nullable: true })
  currency?: string | null;

  @ApiProperty({ nullable: true })
  coverUrl!: string | null;

  @ApiPropertyOptional({ type: AdminProductCategoryDto, nullable: true })
  category?: AdminProductCategoryDto | null;

  @ApiPropertyOptional({ type: AdminProductTopicDto, nullable: true })
  topic?: AdminProductTopicDto | null;

  @ApiPropertyOptional({ type: AdminProductArtistDto, nullable: true })
  artist?: AdminProductArtistDto | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class AdminProductsListMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class AdminProductsListResponseDto {
  @ApiProperty({ type: [AdminProductListItemDto] })
  items!: AdminProductListItemDto[];

  @ApiProperty({ type: AdminProductsListMetaDto })
  meta!: AdminProductsListMetaDto;
}
