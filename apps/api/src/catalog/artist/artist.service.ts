// apps/api/src/catalog/artist/artist.service.ts

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinanceEntitlementSource,
  Prisma,
  ProductStatus,
  RoleName,
  UserStatus,
} from '@prisma/client';

import { PrismaService } from '@app/prisma/prisma.service';
import {
  ArtistMapper,
  type ArtistProfileEntity,
  type ArtistSkillEntity,
  type FollowedArtistEntity,
  type ArtistListEntity,
} from '@app/catalog/artist/artist.mapper';
import { ArtistProductsQueryDto } from '@app/catalog/artist/dtos/artist-products-query.dto';
import {
  ArtistProfileDto,
  ArtistPublicProfileDto,
} from '@app/catalog/artist/dtos/artist-profile.dto';
import { ArtistFollowResponseDto } from '@app/catalog/artist/dtos/artist-follow.dto';
import {
  ProductFindQueryDto,
  type ProductSort,
} from '@app/catalog/product/dtos/product-query.dto';
import {
  productInclude,
  type ProductWithRelations,
} from '@app/catalog/product/product.mapper';
import { ProductListResultDto } from '@app/catalog/product/dtos/product-response.dto';
import { ProductService } from '@app/catalog/product/product.service';
import { FollowedArtistsListDto } from '@app/catalog/artist/dtos/artist-following.dto';
import {
  ArtistListQueryDto,
  type ArtistSortMode,
  ArtistListResultDto,
} from '@app/catalog/artist/dtos/artist-list.dto';
import { EntitlementSource } from '@app/finance/common/finance.enums';

const PUBLIC_PRODUCT_STATUSES: ProductStatus[] = [ProductStatus.PUBLISHED];
const TOP_PRODUCTS_LIMIT = 8;

const ERR_ARTIST_NOT_FOUND = 'Artist not found';
const ERR_SELF_FOLLOW = 'You cannot follow yourself.';

type ArtistWithRolesAndSkills = Prisma.UserGetPayload<{
  select: {
    id: true;
    username: true;
    name: true;
    avatarUrl: true;
    bio: true;
    status: true;
    createdAt: true;
    userRoles: { select: { role: { select: { name: true } } } };
    skills: {
      select: {
        skill: {
          select: {
            id: true;
            key: true;
            nameFa: true;
            nameEn: true;
            isActive: true;
            sortOrder: true;
          };
        };
      };
    };
  };
}>;

@Injectable()
export class ArtistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
  ) {}

  // ───────────────────────────────────────────────────────────────
  // آرشیو هنرمندان (لیست عمومی + جستجو + فیلتر مهارت + سورت)
  // ───────────────────────────────────────────────────────────────
  async listArtists(query: ArtistListQueryDto): Promise<ArtistListResultDto> {
    const page = Math.max(query.page ?? 1, 1);
    const rawLimit = query.limit ?? 24;
    const limit = Math.min(Math.max(rawLimit, 1), 60);
    const skip = (page - 1) * limit;

    const sort: ArtistSortMode = query.sort ?? 'latest';
    const term = query.q?.trim();
    const skillKey = query.skillKey?.trim();

    const whereAnd: Prisma.UserWhereInput[] = [];

    // فقط کاربران active
    whereAnd.push({ status: UserStatus.active });

    // فقط کسانی که نقش supplier دارند
    whereAnd.push({
      userRoles: {
        some: {
          role: { name: RoleName.supplier },
        },
      },
    });

    // جستجو روی name / username / bio
    if (term && term.length > 0) {
      whereAnd.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { username: { contains: term, mode: 'insensitive' } },
          { bio: { contains: term, mode: 'insensitive' } },
        ],
      });
    }

    // فیلتر بر اساس skill
    if (skillKey && skillKey.length > 0 && skillKey !== 'all') {
      whereAnd.push({
        skills: {
          some: {
            skill: {
              key: skillKey,
            },
          },
        },
      });
    }

    const where: Prisma.UserWhereInput =
      whereAnd.length > 0 ? { AND: whereAnd } : {};

    let orderBy: Prisma.UserOrderByWithRelationInput;

    switch (sort) {
      case 'popular':
      case 'mostProducts':
        orderBy = { name: 'asc' };
        break;
      case 'latest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          // اینجا لازم نیست slug بگیریم؛ برای لیست استفاده نمی‌شه
          username: true,
          name: true,
          avatarUrl: true,
          bio: true,
          status: true,
          createdAt: true,
          userRoles: { select: { role: { select: { name: true } } } },
          skills: {
            select: {
              skill: {
                select: {
                  id: true,
                  key: true,
                  nameFa: true,
                  nameEn: true,
                  isActive: true,
                  sortOrder: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const ids = users.map((u) => u.id);
    if (ids.length === 0) {
      return ArtistMapper.toArtistListResult([], 0, page, limit);
    }

    const [followersGroups, productsGroups] = await Promise.all([
      this.prisma.artistFollow.groupBy({
        by: ['artistId'],
        where: { artistId: { in: ids } },
        _count: { artistId: true },
      }),
      this.prisma.productSupplier.groupBy({
        by: ['userId'],
        where: {
          userId: { in: ids },
          product: { status: { in: PUBLIC_PRODUCT_STATUSES } },
        },
        _count: { userId: true },
      }),
    ]);

    const followersMap: Record<string, number> = {};
    followersGroups.forEach((row) => {
      followersMap[row.artistId] = row._count.artistId;
    });

    const productsMap: Record<string, number> = {};
    productsGroups.forEach((row) => {
      productsMap[row.userId] = row._count.userId;
    });

    const entities: ArtistListEntity[] = users.map((user) => {
      const skills: ArtistSkillEntity[] =
        user.skills
          ?.map((userSkill) => userSkill.skill)
          .filter((skill): skill is ArtistSkillEntity => Boolean(skill)) ?? [];

      return {
        id: user.id,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        skills,
        followersCount: followersMap[user.id] ?? 0,
        productsCount: productsMap[user.id] ?? 0,
      };
    });

    let sortedEntities = entities;

    if (sort === 'popular') {
      sortedEntities = [...entities].sort(
        (a, b) => b.followersCount - a.followersCount,
      );
    } else if (sort === 'mostProducts') {
      sortedEntities = [...entities].sort(
        (a, b) => b.productsCount - a.productsCount,
      );
    }

    return ArtistMapper.toArtistListResult(sortedEntities, total, page, limit);
  }

  // ───────────────────────────────────────────────────────────────
  // پروفایل هنرمند + آمار + محصولات برتر
  // ───────────────────────────────────────────────────────────────
  async getProfile(
    artistId: string,
    viewerId?: string,
  ): Promise<ArtistProfileDto> {
    const artist = await this.ensureArtistUser(artistId);

    const [productsCount, followersCount, followRow, topProducts] =
      await Promise.all([
        this.prisma.productSupplier.count({
          where: {
            userId: artist.id,
            product: { status: { in: PUBLIC_PRODUCT_STATUSES } },
          },
        }),
        this.prisma.artistFollow.count({
          where: { artistId: artist.id },
        }),
        viewerId
          ? this.prisma.artistFollow.findUnique({
              where: {
                followerId_artistId: {
                  followerId: viewerId,
                  artistId: artist.id,
                },
              },
              select: { followerId: true },
            })
          : null,
        this.prisma.product.findMany({
          where: {
            status: { in: PUBLIC_PRODUCT_STATUSES },
            supplierLinks: { some: { userId: artist.id } },
          },
          orderBy: [
            { downloadsCount: 'desc' },
            { likesCount: 'desc' },
            { createdAt: 'desc' },
          ],
          take: TOP_PRODUCTS_LIMIT,
          include: productInclude,
        }),
      ]);

    const stats = {
      productsCount,
      followersCount,
      isFollowedByCurrentUser: Boolean(followRow),
    };

    const profileEntity = this.toProfileEntity(artist);

    const profile = ArtistMapper.toProfile(
      profileEntity,
      stats,
      topProducts as ProductWithRelations[],
    );
    if (viewerId && profile.topProducts && profile.topProducts.length > 0) {
      const productIds = topProducts.map((product) => product.id);
      const entitlements = await this.prisma.financeEntitlement.findMany({
        where: {
          userId: viewerId,
          productId: { in: productIds },
          source: EntitlementSource.PURCHASED as FinanceEntitlementSource,
        },
        select: { productId: true },
      });
      const purchasedSet = new Set(
        entitlements.map((row) => row.productId.toString()),
      );
      profile.topProducts.forEach((product) => {
        product.hasPurchased = purchasedSet.has(product.id);
      });
    }
    return profile;
  }

  // ───────────────────────────────────────────────────────────────
  // پروفایل عمومی بر اساس handle (الان فقط username)
  // ───────────────────────────────────────────────────────────────
  async findPublicProfileByHandle(
    handle: string,
  ): Promise<ArtistPublicProfileDto> {
    const artist = await this.ensureArtistUserByHandle(handle);

    const [productsCount, followersCount] = await Promise.all([
      this.prisma.productSupplier.count({
        where: {
          userId: artist.id,
          product: { status: { in: PUBLIC_PRODUCT_STATUSES } },
        },
      }),
      this.countFollowers(artist.id),
    ]);

    const stats = {
      productsCount,
      followersCount,
    };

    const profileEntity = this.toProfileEntity(artist);

    return ArtistMapper.toPublicProfile(profileEntity, stats);
  }

  // پابلیک API قدیمی /by-slug هم عملاً از همین handle استفاده می‌کند
  async findPublicProfileBySlug(slug: string): Promise<ArtistPublicProfileDto> {
    return this.findPublicProfileByHandle(slug);
  }

  // ───────────────────────────────────────────────────────────────
  // لیست محصولات یک هنرمند
  // ───────────────────────────────────────────────────────────────
  async listProducts(
    artistId: string,
    query: ArtistProductsQueryDto,
    viewerId?: string,
  ): Promise<ProductListResultDto> {
    await this.ensureArtistUser(artistId);

    const mergedQuery: ProductFindQueryDto = {
      ...query,
      authorId: artistId,
      sort: (query.sort ?? 'latest') as ProductSort,
    };

    return this.productService.findAll(mergedQuery, viewerId);
  }

  // ───────────────────────────────────────────────────────────────
  // لیست هنرمندانی که کاربر فعلی فالو کرده است
  // ───────────────────────────────────────────────────────────────
  async listMyFollowedArtists(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<FollowedArtistsListDto> {
    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 60);
    const skip = (safePage - 1) * safeLimit;

    const [rows, total] = await Promise.all([
      this.prisma.artistFollow.findMany({
        where: { followerId: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
        include: {
          artist: {
            select: {
              id: true,
              username: true,
              name: true,
              avatarUrl: true,
              bio: true,
            },
          },
        },
      }),
      this.prisma.artistFollow.count({
        where: { followerId: userId },
      }),
    ]);

    const entities: FollowedArtistEntity[] = rows
      .filter((row) => row.artist)
      .map((row) => ({
        id: row.artist!.id,
        username: row.artist!.username,
        name: row.artist!.name,
        avatarUrl: row.artist!.avatarUrl,
        bio: row.artist!.bio,
        followedAt: row.createdAt,
      }));

    return ArtistMapper.toFollowedArtistsList(
      entities,
      total,
      safePage,
      safeLimit,
    );
  }

  // ───────────────────────────────────────────────────────────────
  // Follow / Unfollow
  // ───────────────────────────────────────────────────────────────
  async follow(
    artistId: string,
    followerId: string,
  ): Promise<ArtistFollowResponseDto> {
    this.ensureNotSelfFollow(artistId, followerId);
    await this.ensureArtistUser(artistId);

    await this.prisma.artistFollow.upsert({
      where: { followerId_artistId: { followerId, artistId } },
      create: { artistId, followerId },
      update: {},
    });

    const followersCount = await this.countFollowers(artistId);

    return { followed: true, followersCount };
  }

  async unfollow(
    artistId: string,
    followerId: string,
  ): Promise<ArtistFollowResponseDto> {
    this.ensureNotSelfFollow(artistId, followerId);
    await this.ensureArtistUser(artistId);

    await this.prisma.artistFollow.deleteMany({
      where: { followerId, artistId },
    });

    const followersCount = await this.countFollowers(artistId);

    return { followed: false, followersCount };
  }

  // ───────────────────────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────────────────────

  private async ensureArtistUser(
    artistId: string,
  ): Promise<ArtistWithRolesAndSkills> {
    const artist = await this.fetchArtistRecord({ id: artistId });
    return this.validateArtistUser(artist);
  }

  /**
   * اینجا فقط با username کار می‌کنیم (handle)
   */
  private async ensureArtistUserByHandle(
    handle: string,
  ): Promise<ArtistWithRolesAndSkills> {
    const cleanedHandle = handle.trim();

    if (cleanedHandle.length === 0) {
      throw new NotFoundException(ERR_ARTIST_NOT_FOUND);
    }

    const byUsername = await this.fetchArtistRecord({
      username: { equals: cleanedHandle, mode: 'insensitive' },
    });

    if (byUsername) {
      return this.validateArtistUser(byUsername);
    }

    throw new NotFoundException(ERR_ARTIST_NOT_FOUND);
  }

  private async fetchArtistRecord(
    where: Prisma.UserWhereInput,
  ): Promise<ArtistWithRolesAndSkills | null> {
    return this.prisma.user.findFirst({
      where,
      select: {
        id: true,
        username: true,
        name: true,
        avatarUrl: true,
        bio: true,
        status: true,
        createdAt: true,
        userRoles: { select: { role: { select: { name: true } } } },
        skills: {
          select: {
            skill: {
              select: {
                id: true,
                key: true,
                nameFa: true,
                nameEn: true,
                isActive: true,
                sortOrder: true,
              },
            },
          },
        },
      },
    });
  }

  private async validateArtistUser(
    artist: ArtistWithRolesAndSkills | null,
  ): Promise<ArtistWithRolesAndSkills> {
    if (!artist || artist.status !== UserStatus.active) {
      throw new NotFoundException(ERR_ARTIST_NOT_FOUND);
    }

    const hasSupplierRole = artist.userRoles.some(
      (r) => r.role.name === RoleName.supplier,
    );

    if (hasSupplierRole) {
      return artist;
    }

    const hasProducts = await this.prisma.productSupplier.findFirst({
      where: { userId: artist.id },
      select: { productId: true },
    });

    if (!hasProducts) {
      throw new NotFoundException(ERR_ARTIST_NOT_FOUND);
    }

    return artist;
  }

  private toProfileEntity(
    artist: ArtistWithRolesAndSkills,
  ): ArtistProfileEntity {
    const skills: ArtistSkillEntity[] =
      artist.skills
        ?.map((userSkill) => userSkill.skill)
        .filter((skill): skill is ArtistSkillEntity => Boolean(skill)) ?? [];

    return {
      id: artist.id,
      slug: this.buildArtistSlug(artist),
      username: artist.username,
      name: artist.name,
      avatarUrl: artist.avatarUrl,
      bio: artist.bio,
      skills,
    };
  }

  private buildArtistSlug(artist: ArtistWithRolesAndSkills): string {
    return artist.username ?? artist.id;
  }

  private ensureNotSelfFollow(artistId: string, followerId: string): void {
    if (artistId === followerId) {
      throw new BadRequestException(ERR_SELF_FOLLOW);
    }
  }

  private async countFollowers(artistId: string): Promise<number> {
    return this.prisma.artistFollow.count({
      where: { artistId },
    });
  }
}
