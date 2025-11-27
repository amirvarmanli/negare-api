import { Prisma } from '@prisma/client';
import { ArtistProfileDto } from '@app/catalog/artist/dtos/artist-profile.dto';
import {
  ProductMapper,
  type ProductWithRelations,
} from '@app/catalog/product/product.mapper';

export type ArtistProfileEntity = Prisma.UserGetPayload<{
  select: {
    id: true;
    username: true;
    name: true;
    avatarUrl: true;
    bio: true;
  };
}>;

export type ArtistProfileStats = {
  productsCount: number;
  followersCount: number;
  isFollowedByCurrentUser: boolean;
};

export class ArtistMapper {
  static toProfile(
    artist: ArtistProfileEntity,
    stats: ArtistProfileStats,
    topProducts?: ProductWithRelations[],
  ): ArtistProfileDto {
    return {
      id: artist.id,
      displayName: artist.name ?? artist.username ?? 'Unknown',
      username: artist.username ?? null,
      avatarUrl: artist.avatarUrl ?? null,
      bio: artist.bio ?? null,
      productsCount: stats.productsCount,
      followersCount: stats.followersCount,
      isFollowedByCurrentUser: stats.isFollowedByCurrentUser,
      topProducts: topProducts?.map((p) => ProductMapper.toBrief(p)),
    };
  }
}
