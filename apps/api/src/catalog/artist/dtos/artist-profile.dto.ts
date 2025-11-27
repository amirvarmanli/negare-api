import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductBriefDto } from '@app/catalog/product/dtos/product-response.dto';

export class ArtistProfileDto {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'Display name (name or username fallback)' })
  displayName!: string;

  @ApiPropertyOptional({ description: 'Username of the artist' })
  username?: string | null;

  @ApiPropertyOptional()
  avatarUrl?: string | null;

  @ApiPropertyOptional()
  bio?: string | null;

  @ApiProperty({ description: 'Number of products where the user is a supplier' })
  productsCount!: number;

  @ApiProperty({ description: 'Number of followers' })
  followersCount!: number;

  @ApiProperty({
    description: 'Whether the current viewer follows this artist',
  })
  isFollowedByCurrentUser!: boolean;

  @ApiPropertyOptional({ type: [ProductBriefDto] })
  topProducts?: ProductBriefDto[];
}
