// apps/api/src/catalog/artist/artist.service.ts

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus, RoleName, UserStatus } from '@prisma/client';

import { PrismaService } from '@app/prisma/prisma.service';
import {
  ArtistMapper,
  type ArtistProfileEntity,
  type ArtistSkillEntity,
  type FollowedArtistEntity,
  type ArtistListEntity,
} from '@app/catalog/artist/artist.mapper';
import { ArtistProductsQueryDto } from '@app/catalog/artist/dtos/artist-products-query.dto';
import { ArtistProfileDto } from '@app/catalog/artist/dtos/artist-profile.dto';
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

// فقط محصولات منتشرشده در public دیده می‌شن
const PUBLIC_PRODUCT_STATUSES: ProductStatus[] = [ProductStatus.PUBLISHED];

// حداکثر محصولات برتر در پروفایل
const TOP_PRODUCTS_LIMIT = 8;

// پیام‌های خطا (در صورت نیاز بعداً می‌تونی لوکالایز کنی)
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

    // فقط کسانی که نقش supplier دارند (تعریف "هنرمند")
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

    // سورت پایه روی یوزر (سورت دقیق‌تر براساس فالوئر/محصول رو پایین بعد از map انجام می‌دیم)
    let orderBy: Prisma.UserOrderByWithRelationInput;

    switch (sort) {
      case 'popular':
      case 'mostProducts':
        // فعلاً بر اساس name؛ بعداً می‌تونیم کامل منتقلش کنیم روی followersCount / productsCount
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

    // گروه‌بندی برای شمارش فالوئرها و محصولات
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

    // سورت نهایی در حافظه بر اساس متریک‌ها
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
    // برای latest همان orderBy دیتابیس کافی است

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
        // تعداد محصولاتی که این کاربر supplier آن است
        this.prisma.productSupplier.count({
          where: {
            userId: artist.id,
            product: { status: { in: PUBLIC_PRODUCT_STATUSES } },
          },
        }),

        // تعداد دنبال‌کننده‌ها
        this.prisma.artistFollow.count({
          where: { artistId: artist.id },
        }),

        // آیا بیننده فعلی این هنرمند را فالو کرده؟
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

        // محصولات برتر (بر اساس دانلود، لایک، تاریخ)
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

    return ArtistMapper.toProfile(
      profileEntity,
      stats,
      topProducts as ProductWithRelations[],
    );
  }

  // ───────────────────────────────────────────────────────────────
  // لیست محصولات یک هنرمند (با reuse سرویس Product)
  // ───────────────────────────────────────────────────────────────
  async listProducts(
    artistId: string,
    query: ArtistProductsQueryDto,
  ): Promise<ProductListResultDto> {
    await this.ensureArtistUser(artistId);

    const mergedQuery: ProductFindQueryDto = {
      ...query,
      authorId: artistId,
      sort: (query.sort ?? 'latest') as ProductSort,
    };

    return this.productService.findAll(mergedQuery);
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

  /**
   * اطمینان از این‌که کاربر:
   *  - وجود دارد
   *  - active است
   *  - role supplier دارد
   *  - یا حداقل یک محصول به نام او ثبت شده
   */
  private async ensureArtistUser(
    artistId: string,
  ): Promise<ArtistWithRolesAndSkills> {
    const artist = await this.prisma.user.findUnique({
      where: { id: artistId },
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

  /**
   * نرمال‌سازی دیتای هنرمند برای mapper
   * (همراه با skills برای استفاده در پروفایل / UI)
   */
  private toProfileEntity(
    artist: ArtistWithRolesAndSkills,
  ): ArtistProfileEntity {
    const skills: ArtistSkillEntity[] =
      artist.skills
        ?.map((userSkill) => userSkill.skill)
        .filter((skill): skill is ArtistSkillEntity => Boolean(skill)) ?? [];

    return {
      id: artist.id,
      username: artist.username,
      name: artist.name,
      avatarUrl: artist.avatarUrl,
      bio: artist.bio,
      skills,
    };
  }

  /**
   * جلوگیری از فالو کردن خود
   */
  private ensureNotSelfFollow(artistId: string, followerId: string): void {
    if (artistId === followerId) {
      throw new BadRequestException(ERR_SELF_FOLLOW);
    }
  }

  /**
   * شمارش تعداد دنبال‌کننده‌های هنرمند
   */
  private async countFollowers(artistId: string): Promise<number> {
    return this.prisma.artistFollow.count({
      where: { artistId },
    });
  }
}
