// apps/api/src/core/catalog/product/dto/product-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PricingType, ProductStatus, GraphicFormat } from '@prisma/client';

export class ProductAuthorDto {
  @ApiProperty() userId!: string;
  @ApiPropertyOptional() role?: string | null;
}

export class ProductDetailAuthorDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) avatarUrl!: string | null;
  @ApiProperty({
    description: 'Total number of products authored by this user',
  })
  productsCount!: number;
}

export class ProductTagDto {
  @ApiProperty() id!: string; // BigInt → string
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
}

export class ProductCategoryDto {
  @ApiProperty() id!: string; // BigInt → string
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiPropertyOptional() parentId?: string | null; // BigInt → string
  @ApiPropertyOptional() coverUrl?: string | null;
}

export class ProductAssetDto {
  @ApiProperty() id!: string; // BigInt → string
  @ApiProperty() url!: string;
  @ApiPropertyOptional() alt?: string | null;
  @ApiProperty() order!: number;
}

export class ProductTopicDto {
  @ApiProperty({
    description: 'Topic id (BigInt as string) used when editing topics',
  })
  topicId!: string;
  @ApiProperty({
    description:
      'Alias for topicId kept for backward compatibility with older clients',
  })
  id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiPropertyOptional() coverUrl?: string | null;
  @ApiProperty() order!: number;
}

export class ProductFileDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({
    description: 'UUID of the uploaded file (core.files.id) powering this entry',
  })
  fileId?: string | null;
  @ApiProperty() storageKey!: string;
  @ApiPropertyOptional() originalName?: string | null;
  @ApiPropertyOptional({
    description: 'Size stored for the source file in bytes (stringified BigInt)',
  })
  size?: string;
  @ApiPropertyOptional() mimeType?: string | null;
  @ApiPropertyOptional({ description: 'Arbitrary metadata saved with the file' })
  meta?: Record<string, unknown> | null;
}

export class ProductBriefDto {
  @ApiProperty() id!: string; // BigInt → string
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() coverUrl?: string | null;

  @ApiProperty({ enum: GraphicFormat, isArray: true })
  graphicFormats!: GraphicFormat[];
  @ApiProperty({ type: [String], description: 'Array of HEX colors (#RRGGBB)' })
  colors!: string[];
  @ApiProperty({ enum: PricingType }) pricingType!: PricingType;
  @ApiPropertyOptional() price?: number | null;

  @ApiProperty({ nullable: true }) creatorId!: string | null;
  @ApiProperty() creatorName!: string;
  @ApiProperty({ nullable: true }) creatorAvatarUrl!: string | null;

  @ApiProperty({ enum: ProductStatus }) status!: ProductStatus;

  @ApiProperty() viewsCount!: number;
  @ApiProperty() downloadsCount!: number;
  @ApiProperty() likesCount!: number;

  @ApiProperty({
    description: 'Whether the current user liked this product',
    default: false,
  })
  isLikedByCurrentUser!: boolean;

  @ApiProperty({
    description: 'Whether the current user bookmarked this product',
    default: false,
  })
  isBookmarkedByCurrentUser!: boolean;

  @ApiPropertyOptional() shortLink?: string | null;

  @ApiPropertyOptional({ type: [String] }) seoKeywords?: string[];
  @ApiPropertyOptional() seoTitle?: string | null;
  @ApiPropertyOptional() seoDescription?: string | null;

  @ApiProperty({
    description: 'Convenience size selector exposed to clients',
    example: 24,
  })
  fileSizeMB!: number;
  @ApiPropertyOptional({
    description: 'File size in bytes represented as a string',
  })
  fileBytes?: string;

  @ApiPropertyOptional() createdAt?: string;
  @ApiPropertyOptional() updatedAt?: string;
}

export class ProductDetailDto extends ProductBriefDto {
  @ApiPropertyOptional() description?: string | null;
  @ApiPropertyOptional({
    description: 'UUID of the uploaded file linked to this product',
  })
  fileId?: string | null;

  @ApiPropertyOptional({ type: [ProductAssetDto] }) assets?: ProductAssetDto[];
  @ApiPropertyOptional({ type: [ProductCategoryDto] })
  categories?: ProductCategoryDto[];
  @ApiPropertyOptional({ type: [ProductTagDto] }) tags?: ProductTagDto[];
  @ApiPropertyOptional({ type: [ProductAuthorDto] })
  authors?: ProductAuthorDto[];
  @ApiPropertyOptional({ type: ProductDetailAuthorDto })
  author?: ProductDetailAuthorDto;
  @ApiPropertyOptional({ type: [ProductTopicDto] }) topics?: ProductTopicDto[];
  @ApiPropertyOptional({ type: ProductFileDto }) file?: ProductFileDto;
}

export class ProductListResultDto {
  @ApiProperty({ type: [ProductBriefDto] }) items!: ProductBriefDto[];
  @ApiPropertyOptional({ description: 'cursor opaque (base64)' })
  nextCursor?: string;
}

export class ProductPaginatedResultDto {
  @ApiProperty({ type: [ProductBriefDto] }) items!: ProductBriefDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() hasNext!: boolean;
}

export class ProductSearchResultDto extends ProductPaginatedResultDto {}
