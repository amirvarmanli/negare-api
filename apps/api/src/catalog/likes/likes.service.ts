// apps/api/src/core/catalog/likes/likes.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import {
  ProductMapper,
  productInclude,
  type ProductWithRelations,
} from '@app/catalog/product/product.mapper';
import { FinanceEntitlementSource, Prisma } from '@prisma/client';
import { EntitlementSource } from '@app/finance/common/finance.enums';
import { Buffer } from 'buffer';
import { LikeToggleResponseDto } from '@app/catalog/likes/dtos/like-toggle.dto';
import { UserLikeItemDto, UserLikesResultDto } from '@app/catalog/likes/dtos/likes-response.dto';

/* ---------------- Helpers ---------------- */
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
function toBigIntOrThrow(id: string): bigint {
  if (!/^\d+$/.test(id)) throw new BadRequestException('Invalid product id');
  return BigInt(id);
}

/** Like + product include typing */
type LikeWithProduct = Prisma.LikeGetPayload<{
  include: { product: { include: typeof productInclude } };
}>;

@Injectable()
export class LikesService {
  constructor(private readonly prisma: PrismaService) {}

  /** لایک یا آن‌لایک کردن محصول */
  async toggle(
    userId: string,
    productIdStr: string,
  ): Promise<LikeToggleResponseDto> {
    const productId = toBigIntOrThrow(productIdStr);

    const existing = await this.prisma.like.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existing) {
      await this.prisma.$transaction([
        this.prisma.like.delete({
          where: { userId_productId: { userId, productId } },
        }),
        this.prisma.product.update({
          where: { id: productId },
          data: { likesCount: { decrement: 1 } },
        }),
      ]);
    } else {
      await this.prisma.$transaction([
        this.prisma.like.create({
          data: {
            product: { connect: { id: productId } },
            user: { connect: { id: userId } },
          },
        }),
        this.prisma.product.update({
          where: { id: productId },
          data: { likesCount: { increment: 1 } },
        }),
      ]);
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { likesCount: true },
    });

    return {
      productId: productId.toString(),
      liked: !existing,
      likesCount: product?.likesCount ?? 0,
    };
  }

  /** لیست محصولات لایک‌شده‌ی کاربر (Load more با cursor: createdAt, productId) */
  async listForUser(
    userId: string,
    limit = 24,
    cursor?: string,
  ): Promise<UserLikesResultDto> {
    const take = Math.min(Math.max(limit, 1), 60);

    type CursorT = { createdAt: string; productId: string };
    const c = decodeCursor<CursorT>(cursor);

    let cursorWhere: Prisma.LikeWhereInput | undefined;
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

    const where: Prisma.LikeWhereInput = cursorWhere
      ? { AND: [{ userId }, cursorWhere] }
      : { userId };

    const rows = await this.prisma.like.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { productId: 'desc' }], // ⬅️ به‌جای id
      take,
      include: { product: { include: productInclude } },
    });

    const typed = rows as LikeWithProduct[];

    const productIds = typed.map((like) => like.productId);
    const bookmarkedSet = new Set<string>();
    if (productIds.length > 0) {
      const bookmarked = await this.prisma.bookmark.findMany({
        where: { userId, productId: { in: productIds } },
        select: { productId: true },
      });
      bookmarked.forEach((row) => bookmarkedSet.add(row.productId.toString()));
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

    const items: UserLikeItemDto[] = typed.map((l) => {
      const product = ProductMapper.toBrief(l.product as ProductWithRelations);
      product.isLikedByCurrentUser = true;
      product.isBookmarkedByCurrentUser = bookmarkedSet.has(
        l.productId.toString(),
      );
      product.hasPurchased = purchasedSet.has(l.productId.toString());
      return {
        product,
        likedAt: l.createdAt.toISOString(),
      };
    });

    let nextCursor: string | undefined;
    if (typed.length === take) {
      const last = typed[typed.length - 1];
      nextCursor = encodeCursor({
        createdAt: last.createdAt.toISOString(),
        productId: String(last.productId),
      });
    }

    return { items, nextCursor };
  }
}
