import { ArtistProfileDto } from '@app/catalog/artist/dtos/artist-profile.dto';
import {
  ProductMapper,
  type ProductWithRelations,
} from '@app/catalog/product/product.mapper';
import {
  FollowedArtistItemDto,
  FollowedArtistsListDto,
} from '@app/catalog/artist/dtos/artist-following.dto';
import {
  ArtistListItemDto,
  ArtistListResultDto,
} from '@app/catalog/artist/dtos/artist-list.dto';

/**
 * نمای داخلی مهارت هنرمند در لایه‌ی دامین
 */
export type ArtistSkillEntity = {
  id: string;
  key: string;
  nameFa: string;
  nameEn: string | null;
  isActive: boolean;
  sortOrder: number;
};

/**
 * نمای داخلی پروفایل هنرمند که سرویس ArtistService
 * از طریق متد `toProfileEntity` می‌سازد و به Mapper می‌دهد.
 */
export type ArtistProfileEntity = {
  id: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  bio: string | null;
  skills: ArtistSkillEntity[];
};

export type ArtistProfileStats = {
  productsCount: number;
  followersCount: number;
  isFollowedByCurrentUser: boolean;
};

/**
 * نمای داخلی هنرمندی که توسط کاربر فالو شده است
 * (برای لیست "هنرمندانی که دنبال می‌کنید")
 */
export type FollowedArtistEntity = {
  id: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  bio: string | null;
  followedAt: Date;
};

/**
 * نمای داخلی هنرمند برای آرشیو هنرمندان (لیست عمومی)
 */
export type ArtistListEntity = {
  id: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  bio: string | null;
  skills: ArtistSkillEntity[];
  followersCount: number;
  productsCount: number;
};

export class ArtistMapper {
  // ───────────────────────────────────────────────────────────────
  // پروفایل هنرمند
  // ───────────────────────────────────────────────────────────────
  static toProfile(
    artist: ArtistProfileEntity,
    stats: ArtistProfileStats,
    topProducts?: ProductWithRelations[],
  ): ArtistProfileDto {
    const rawName = artist.name?.trim();
    const displayName =
      rawName && rawName.length > 0
        ? rawName
        : (artist.username ?? 'هنرمند ناشناس');

    return {
      id: artist.id,
      displayName,
      username: artist.username,
      avatarUrl: artist.avatarUrl,
      bio: artist.bio,
      skills: (artist.skills ?? []).map((skill) => ({
        id: skill.id,
        key: skill.key,
        nameFa: skill.nameFa,
        nameEn: skill.nameEn,
        isActive: skill.isActive,
        sortOrder: skill.sortOrder,
      })),
      productsCount: stats.productsCount,
      followersCount: stats.followersCount,
      isFollowedByCurrentUser: stats.isFollowedByCurrentUser,
      topProducts: topProducts?.map((p) => ProductMapper.toBrief(p)),
    };
  }

  // ───────────────────────────────────────────────────────────────
  // لیست هنرمندانی که کاربر فالو کرده است
  // ───────────────────────────────────────────────────────────────

  /**
   * مپ یک هنرمند فالو شده به DTO آیتم لیست
   */
  static toFollowedArtistItem(
    entity: FollowedArtistEntity,
  ): FollowedArtistItemDto {
    const rawName = entity.name?.trim();
    const displayName =
      rawName && rawName.length > 0
        ? rawName
        : (entity.username ?? 'هنرمند ناشناس');

    return {
      id: entity.id,
      displayName,
      username: entity.username,
      avatarUrl: entity.avatarUrl,
      bio: entity.bio,
      followedAt: entity.followedAt,
    };
  }
  /**
   * مپ آرایه‌ی هنرمندان فالو شده به DTO لیست کامل (با pagination)
   */
  static toFollowedArtistsList(
    entities: FollowedArtistEntity[],
    total: number,
    page: number,
    limit: number,
  ): FollowedArtistsListDto {
    return {
      items: entities.map((e) => this.toFollowedArtistItem(e)),
      total,
      page,
      limit,
    };
  }

  // ───────────────────────────────────────────────────────────────
  // لیست عمومی هنرمندان (آرشیو هنرمندان)
  // ───────────────────────────────────────────────────────────────

  /**
   * مپ یک هنرمند به آیتم لیست آرشیو
   */
  static toArtistListItem(entity: ArtistListEntity): ArtistListItemDto {
    const rawName = entity.name?.trim();
    const displayName =
      rawName && rawName.length > 0
        ? rawName
        : (entity.username ?? 'هنرمند ناشناس');

    return {
      id: entity.id,
      displayName,
      username: entity.username,
      avatarUrl: entity.avatarUrl,
      bio: entity.bio,
      skills: (entity.skills ?? []).map((skill) => ({
        id: skill.id,
        key: skill.key,
        nameFa: skill.nameFa,
        nameEn: skill.nameEn,
        isActive: skill.isActive,
        sortOrder: skill.sortOrder,
      })),
      followersCount: entity.followersCount,
      productsCount: entity.productsCount,
    };
  }

  /**
   * مپ لیست هنرمندان به نتیجه‌ی صفحه‌بندی شده برای آرشیو
   */
  static toArtistListResult(
    entities: ArtistListEntity[],
    total: number,
    page: number,
    limit: number,
  ): ArtistListResultDto {
    const safeLimit = limit > 0 ? limit : 1;
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return {
      items: entities.map((e) => this.toArtistListItem(e)),
      total,
      page,
      limit: safeLimit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }
}
