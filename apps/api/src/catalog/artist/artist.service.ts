import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus, RoleName, UserStatus } from '@prisma/client';
import { PrismaService } from '@app/prisma/prisma.service';
import { ArtistMapper, ArtistProfileEntity } from '@app/catalog/artist/artist.mapper';
import { ArtistProductsQueryDto } from '@app/catalog/artist/dtos/artist-products-query.dto';
import { ArtistProfileDto } from '@app/catalog/artist/dtos/artist-profile.dto';
import { ArtistFollowResponseDto } from '@app/catalog/artist/dtos/artist-follow.dto';
import { ProductFindQueryDto, ProductSort } from '@app/catalog/product/dtos/product-query.dto';
import { productInclude, type ProductWithRelations } from '@app/catalog/product/product.mapper';
import { ProductListResultDto } from '@app/catalog/product/dtos/product-response.dto';
import { ProductService } from '@app/catalog/product/product.service';

const PUBLIC_PRODUCT_STATUSES: ProductStatus[] = [
  ProductStatus.DRAFT,
  ProductStatus.PUBLISHED,
];
const TOP_PRODUCTS_LIMIT = 8;

type ArtistWithRoles = Prisma.UserGetPayload<{
  select: {
    id: true;
    username: true;
    name: true;
    avatarUrl: true;
    bio: true;
    status: true;
    userRoles: { select: { role: { select: { name: true } } } };
  };
}>;

@Injectable()
export class ArtistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
  ) {}

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
        this.prisma.artistFollow.count({ where: { artistId: artist.id } }),
        viewerId
          ? this.prisma.artistFollow.findUnique({
              where: {
                followerId_artistId: { followerId: viewerId, artistId },
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

    return ArtistMapper.toProfile(
      this.toProfileEntity(artist),
      stats,
      topProducts as ProductWithRelations[],
    );
  }

  async listProducts(
    artistId: string,
    query: ArtistProductsQueryDto,
  ): Promise<ProductListResultDto> {
    await this.ensureArtistUser(artistId);
    const merged: ProductFindQueryDto = {
      ...query,
      authorId: artistId,
      sort: (query.sort ?? 'latest') as ProductSort,
    };
    return this.productService.findAll(merged);
  }

  async follow(
    artistId: string,
    followerId: string,
  ): Promise<ArtistFollowResponseDto> {
    if (artistId === followerId) {
      throw new BadRequestException('You cannot follow yourself.');
    }
    await this.ensureArtistUser(artistId);
    await this.prisma.artistFollow.upsert({
      where: { followerId_artistId: { followerId, artistId } },
      create: { artistId, followerId },
      update: {},
    });
    const followersCount = await this.prisma.artistFollow.count({
      where: { artistId },
    });
    return { followed: true, followersCount };
  }

  async unfollow(
    artistId: string,
    followerId: string,
  ): Promise<ArtistFollowResponseDto> {
    if (artistId === followerId) {
      throw new BadRequestException('You cannot follow yourself.');
    }
    await this.ensureArtistUser(artistId);
    await this.prisma.artistFollow.deleteMany({
      where: { followerId, artistId },
    });
    const followersCount = await this.prisma.artistFollow.count({
      where: { artistId },
    });
    return { followed: false, followersCount };
  }

  private async ensureArtistUser(artistId: string): Promise<ArtistWithRoles> {
    const artist = await this.prisma.user.findUnique({
      where: { id: artistId },
      select: {
        id: true,
        username: true,
        name: true,
        avatarUrl: true,
        bio: true,
        status: true,
        userRoles: { select: { role: { select: { name: true } } } },
      },
    });
    if (!artist || artist.status !== UserStatus.active) {
      throw new NotFoundException('Artist not found');
    }
    const hasSupplierRole = artist.userRoles.some(
      (r: ArtistWithRoles['userRoles'][number]) =>
        r.role.name === RoleName.supplier,
    );
    if (hasSupplierRole) {
      return artist;
    }
    const hasProducts = await this.prisma.productSupplier.findFirst({
      where: { userId: artist.id },
      select: { productId: true },
    });
    if (!hasProducts) {
      throw new NotFoundException('Artist not found');
    }
    return artist;
  }

  private toProfileEntity(artist: ArtistWithRoles): ArtistProfileEntity {
    return {
      id: artist.id,
      username: artist.username,
      name: artist.name,
      avatarUrl: artist.avatarUrl,
      bio: artist.bio,
    };
  }
}
