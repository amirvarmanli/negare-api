import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PricingType } from '@prisma/client';
import { PrismaService } from '@app/prisma/prisma.service';
import { clampPagination } from '@app/catalog/utils/pagination.util';
import { normalizeFaText } from '@shared-slug/search/fa-search.util';
import { buildProductIdOrSlugWhere } from '@app/catalog/product/product.service';
import {
  AdminProductOrder,
  AdminProductSaleType,
  AdminProductSortBy,
  AdminProductsListQueryDto,
  AdminProductsMineQueryDto,
} from '@app/catalog/product/dtos/admin-products-query.dto';
import { AdminProductBumpResponseDto } from '@app/catalog/product/dtos/admin-product-bump.dto';
import {
  AdminProductListItemDto,
  AdminProductsListMetaDto,
  AdminProductsListResponseDto,
} from '@app/catalog/product/dtos/admin-products-list.dto';

const ADMIN_PRODUCT_SELECT: Prisma.ProductSelect = {
  id: true,
  title: true,
  slug: true,
  status: true,
  pricingType: true,
  price: true,
  coverUrl: true,
  pinnedAt: true,
  createdAt: true,
  updatedAt: true,
  assets: {
    take: 1,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: {
      url: true,
    },
  },
  categoryLinks: {
    select: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  topics: {
    select: {
      topic: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  supplierLinks: {
    select: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          avatarUrl: true,
        },
      },
    },
  },
};

type AdminProductRow = Prisma.ProductGetPayload<{
  select: typeof ADMIN_PRODUCT_SELECT;
}>;

@Injectable()
export class AdminProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async bump(
    idOrSlug: string,
  ): Promise<AdminProductBumpResponseDto> {
    const where = buildProductIdOrSlugWhere(idOrSlug);
    const product = await this.prisma.product.findFirst({
      where,
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const updated = await this.prisma.product.update({
      where: { id: product.id },
      data: {
        pinnedAt: new Date(),
      },
      select: {
        id: true,
        pinnedAt: true,
      },
    });

    return {
      id: updated.id.toString(),
      pinnedAt: updated.pinnedAt ? updated.pinnedAt.toISOString() : null,
    };
  }

  async list(
    query: AdminProductsListQueryDto,
  ): Promise<AdminProductsListResponseDto> {
    const { page, limit, skip } = clampPagination(
      query.page,
      query.limit ?? 20,
      100,
    );

    const where = this.buildWhere(query, { includeArtistSearch: true });
    const orderBy = this.buildOrderBy(query.sortBy, query.order);

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: ADMIN_PRODUCT_SELECT,
      }),
      this.prisma.product.count({ where }),
    ]);

    const items: AdminProductListItemDto[] = rows.map((row) =>
      this.mapProduct(row),
    );

    const meta: AdminProductsListMetaDto = {
      page,
      limit,
      total,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    };

    return { items, meta };
  }

  async listMine(
    userId: string,
    query: AdminProductsMineQueryDto,
  ): Promise<AdminProductsListResponseDto> {
    const { page, limit, skip } = clampPagination(
      query.page,
      query.limit ?? 20,
      100,
    );

    const where = this.buildWhere(query, {
      includeArtistSearch: false,
      userId,
    });
    const orderBy = this.buildOrderBy(query.sortBy, query.order);

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: ADMIN_PRODUCT_SELECT,
      }),
      this.prisma.product.count({ where }),
    ]);

    const items: AdminProductListItemDto[] = rows.map((row) =>
      this.mapProduct(row),
    );

    const meta: AdminProductsListMetaDto = {
      page,
      limit,
      total,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    };

    return { items, meta };
  }

  private mapProduct(row: AdminProductRow): AdminProductListItemDto {
    const categoryLink = row.categoryLinks?.[0] as
      | { category?: { id: bigint; name: string } }
      | undefined;
    const topicLink = row.topics?.[0] as
      | { topic?: { id: bigint; name: string } }
      | undefined;
    const supplierLink = row.supplierLinks?.[0] as
      | { user?: { id: string; name: string | null; username: string | null; avatarUrl: string | null } }
      | undefined;

    const category = categoryLink?.category;
    const topic = topicLink?.topic;
    const user = supplierLink?.user;

    return {
      id: row.id.toString(),
      title: row.title,
      slug: row.slug,
      publishStatus: row.status,
      pinnedAt: row.pinnedAt ? row.pinnedAt.toISOString() : null,
      saleType: this.normalizeSaleType(row.pricingType),
      price:
        row.price === null || row.price === undefined
          ? null
          : Number(row.price),
      currency: null,
      coverUrl: this.resolveCoverUrl(row),
      category: category
        ? {
            id: String(category.id),
            title: category.name,
          }
        : null,
      topic: topic
        ? {
            id: String(topic.id),
            title: topic.name,
          }
        : null,
      artist: user
        ? {
            id: user.id,
            name: this.resolveArtistName(user.name, user.username),
            avatarUrl: user.avatarUrl ?? null,
          }
        : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private resolveCoverUrl(row: AdminProductRow): string | null {
    if (row.coverUrl && row.coverUrl.trim().length > 0) {
      return row.coverUrl;
    }

    const assets = row.assets ?? [];
    const firstAsset = assets[0];
    if (firstAsset?.url) {
      return firstAsset.url;
    }

    return null;
  }

  private buildWhere(
    query: AdminProductsListQueryDto | AdminProductsMineQueryDto,
    options?: { userId?: string; includeArtistSearch?: boolean },
  ): Prisma.ProductWhereInput {
    const filters: Prisma.ProductWhereInput[] = [];

    if (query.publishStatus) {
      filters.push({ status: query.publishStatus });
    }

    if (query.saleType) {
      const pricingType = this.mapSaleType(query.saleType);
      if (pricingType) {
        filters.push({ pricingType });
      }
    }

    const categoryId = this.tryParseBigInt(query.categoryId);
    if (categoryId !== undefined) {
      filters.push({
        categoryLinks: { some: { categoryId } },
      });
    }

    const topicId = this.tryParseBigInt(query.topicId);
    if (topicId !== undefined) {
      filters.push({
        topics: { some: { topicId } },
      });
    }

    if ('artistId' in query && query.artistId) {
      filters.push({
        supplierLinks: { some: { userId: query.artistId } },
      });
    }

    if (options?.userId) {
      filters.push({
        supplierLinks: { some: { userId: options.userId } },
      });
    }

    const qWhere = this.buildQueryWhere(query.q, {
      includeArtistSearch: options?.includeArtistSearch ?? false,
    });
    if (qWhere) {
      filters.push(qWhere);
    }

    return filters.length ? { AND: filters } : {};
  }

  private buildOrderBy(
    sortBy?: AdminProductSortBy,
    order?: AdminProductOrder,
  ): Prisma.ProductOrderByWithRelationInput[] {
    const direction = (order ?? AdminProductOrder.desc) as Prisma.SortOrder;
    const key = sortBy ?? AdminProductSortBy.createdAt;
    // IMPORTANT:
    // pinnedAt is a bump ACTION.
    // It must ALWAYS be sorted DESC with NULLS LAST,
    // otherwise bumped products will fall to the bottom.
    const pinnedOrdering: Prisma.ProductOrderByWithRelationInput[] = [
      {
        pinnedAt: {
          sort: 'desc',
          nulls: 'last',
        },
      },
    ];
    switch (key) {
      case AdminProductSortBy.price:
        return [...pinnedOrdering, { price: direction }, { id: 'desc' }];
      case AdminProductSortBy.updatedAt:
        return [...pinnedOrdering, { updatedAt: direction }, { id: 'desc' }];
      case AdminProductSortBy.title:
        return [...pinnedOrdering, { title: direction }, { id: 'desc' }];
      default:
        return [...pinnedOrdering, { createdAt: direction }, { id: 'desc' }];
    }
  }

  private buildQueryWhere(
    q?: string,
    options?: { includeArtistSearch?: boolean },
  ): Prisma.ProductWhereInput | undefined {
    const trimmed = q?.trim();
    if (!trimmed) return undefined;

    const normalizedTerm = normalizeFaText(trimmed);
    const textTerm = normalizedTerm.length ? normalizedTerm : trimmed;
    const or: Prisma.ProductWhereInput[] = [];

    if (textTerm.length > 0) {
      or.push({ title: { contains: textTerm, mode: 'insensitive' } });
      or.push({ slug: { contains: textTerm, mode: 'insensitive' } });
    }

    const productId = this.tryParseProductId(trimmed);
    if (productId) {
      or.push({ id: productId });
    }

    if (options?.includeArtistSearch) {
      or.push({
        supplierLinks: {
          some: {
            user: {
              OR: [
                { name: { contains: textTerm, mode: 'insensitive' } },
                { username: { contains: trimmed, mode: 'insensitive' } },
              ],
            },
          },
        },
      });
    }

    return or.length ? { OR: or } : undefined;
  }

  private tryParseProductId(value: string): bigint | undefined {
    if (!/^\d+$/u.test(value)) {
      return undefined;
    }
    try {
      return BigInt(value);
    } catch {
      return undefined;
    }
  }

  private tryParseBigInt(value?: string): bigint | undefined {
    if (!value) return undefined;
    try {
      return BigInt(value);
    } catch {
      return undefined;
    }
  }

  private mapSaleType(value: AdminProductSaleType): PricingType {
    if (value === AdminProductSaleType.SUBSCRIPTION) {
      return PricingType.PAID_OR_SUBSCRIPTION;
    }
    return value as PricingType;
  }

  private normalizeSaleType(
    pricingType: PricingType,
  ): 'FREE' | 'PAID' | 'SUBSCRIPTION' {
    return pricingType === PricingType.PAID_OR_SUBSCRIPTION
      ? 'SUBSCRIPTION'
      : pricingType;
  }

  private resolveArtistName(
    name?: string | null,
    username?: string | null,
  ): string {
    const trimmed = name?.trim();
    if (trimmed && trimmed.length > 0) {
      return trimmed;
    }
    return username ?? 'Artist';
  }
}
