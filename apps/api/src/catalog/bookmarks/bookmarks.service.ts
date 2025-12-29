import { Injectable, BadRequestException } from '@nestjs/common';
import { FinanceEntitlementSource, Prisma } from '@prisma/client';
import { EntitlementSource } from '@app/finance/common/finance.enums';
import { Buffer } from 'buffer';
import { PrismaService } from '@app/prisma/prisma.service';
import { BookmarkListQueryDto } from '@app/catalog/bookmarks/dtos/bookmark-query.dto';
import {
  UserBookmarkItemDto,
  UserBookmarksResultDto,
} from '@app/catalog/bookmarks/dtos/bookmark-response.dto';
import {
  ProductMapper,
  productInclude,
  type ProductWithRelations,
} from '@app/catalog/product/product.mapper';

type BookmarkWithProduct = Prisma.BookmarkGetPayload<{
  include: { product: { include: typeof productInclude } };
}>;

function toBigIntNullable(id?: string): bigint | null {
  if (!id || !/^\d+$/.test(id)) return null;
  return BigInt(id);
}

function encodeCursor(obj: Record<string, string | number>) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}
function decodeCursor<T>(cursor?: string | null): T | null {
  if (!cursor) return null;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

@Injectable()
export class BookmarksService {
  constructor(private readonly prisma: PrismaService) {}

  /* -------------------------------------------
   * Toggle bookmark for a user/product
   * ----------------------------------------- */
  async toggle(
    userId: string,
    productIdStr: string,
  ): Promise<{ productId: string; bookmarked: boolean }> {
    const productId = toBigIntNullable(productIdStr);
    if (productId === null) throw new BadRequestException('Invalid product id');

    const existed = await this.prisma.bookmark.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existed) {
      await this.prisma.bookmark.delete({
        where: { userId_productId: { userId, productId } },
      });
      return { productId: productId.toString(), bookmarked: false };
    }
    await this.prisma.bookmark.create({ data: { userId, productId } });
    return { productId: productId.toString(), bookmarked: true };
  }

  /* -------------------------------------------
   * Remove (explicit unbookmark)
   * ----------------------------------------- */
  async remove(userId: string, productIdStr: string): Promise<void> {
    const productId = toBigIntNullable(productIdStr);
    if (productId === null) throw new BadRequestException('Invalid product id');
    await this.prisma.bookmark.deleteMany({ where: { userId, productId } });
  }

  /* -------------------------------------------
   * Check if bookmarked
   * ----------------------------------------- */
  async isBookmarked(
    userId: string,
    productIdStr: string,
  ): Promise<{ bookmarked: boolean }> {
    const productId = toBigIntNullable(productIdStr);
    if (productId === null) throw new BadRequestException('Invalid product id');
    const existed = await this.prisma.bookmark.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { userId: true },
    });
    return { bookmarked: !!existed };
  }

  /* -------------------------------------------
   * List bookmarks for current user (Load more)
   * Order: newest bookmarked first
   * ----------------------------------------- */
  async listForUser(
    userId: string,
    q: BookmarkListQueryDto,
  ): Promise<UserBookmarksResultDto> {
    const limit = Math.min(Math.max(q.limit ?? 24, 1), 60);

    type CursorT = { createdAt: string; productId: string };
    const c = decodeCursor<CursorT>(q.cursor);
    let cursorWhere: Prisma.BookmarkWhereInput | undefined;

    if (c) {
      const createdAt = new Date(c.createdAt);
      const pid = BigInt(c.productId);
      cursorWhere = {
        OR: [
          { createdAt: { lt: createdAt } },
          { AND: [{ createdAt: createdAt }, { productId: { lt: pid } }] },
        ],
      };
    }

    const where: Prisma.BookmarkWhereInput = cursorWhere
      ? { AND: [{ userId }, cursorWhere] }
      : { userId };

    const rows: BookmarkWithProduct[] = await this.prisma.bookmark.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { productId: 'desc' }],
      take: limit,
      include: { product: { include: productInclude } },
    });

    const productIds = rows.map((row) => row.productId);
    const likedSet = new Set<string>();
    if (productIds.length > 0) {
      const likedRows = await this.prisma.like.findMany({
        where: { userId, productId: { in: productIds } },
        select: { productId: true },
      });
      likedRows.forEach((row) => likedSet.add(row.productId.toString()));
    }
    const purchasedSet = new Set<string>();
    if (productIds.length > 0) {
      const entitlements = await this.prisma.financeEntitlement.findMany({
        where: {
          userId,
          productId: { in: productIds },
          source: EntitlementSource.PURCHASED as FinanceEntitlementSource,
        },
        select: { productId: true },
      });
      entitlements.forEach((row) =>
        purchasedSet.add(row.productId.toString()),
      );
    }

    const items: UserBookmarkItemDto[] = rows.map(
      (b: BookmarkWithProduct) => {
        const product = ProductMapper.toBrief(
          b.product as ProductWithRelations,
        );
        product.isBookmarkedByCurrentUser = true;
      product.isLikedByCurrentUser = likedSet.has(b.productId.toString());
      product.hasPurchased = purchasedSet.has(b.productId.toString());
      return {
          product,
          bookmarkedAt: b.createdAt.toISOString(),
        };
      },
    );

    let nextCursor: string | undefined;
    if (rows.length === limit) {
      const last = rows[rows.length - 1];
      nextCursor = encodeCursor({
        createdAt: last.createdAt.toISOString(),
        productId: String(last.productId),
      });
    }

    return { items, nextCursor };
  }
}
