import { Prisma, PricingType, ProductStatus } from '@prisma/client';
import {
  ProductAssetDto,
  ProductAuthorDto,
  ProductBriefDto,
  ProductCategoryDto,
  ProductDetailDto,
  ProductFileDto,
  ProductTagDto,
  ProductTopicDto,
} from '@app/catalog/product/dtos/product-response.dto';

/** include استاندارد که سرویس هم باید ازش استفاده کند تا تایپ‌ها درست Resolve شوند */
export const productInclude = {
  assets: { orderBy: { sortOrder: 'asc' } },
  categoryLinks: { include: { category: true } },
  tagLinks: { include: { tag: true } },
  supplierLinks: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          _count: {
            select: {
              productSuppliers: true,
            },
          },
        },
      },
    },
  },
  topics: { include: { topic: true }, orderBy: { order: 'asc' } },
  file: true,
} as const satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

type ProductAssetEntity = ProductWithRelations['assets'][number];
type ProductCategoryLinkEntity = ProductWithRelations['categoryLinks'][number];
type ProductTagLinkEntity = ProductWithRelations['tagLinks'][number];
type ProductSupplierLinkEntity = ProductWithRelations['supplierLinks'][number];
type ProductTopicLinkEntity = ProductWithRelations['topics'][number];

/* ============================================================
 * Helpers (type-safe, بدون any)
 * ========================================================== */

/** فقط زمانی مقدار را نگه می‌داریم که یک آبجکت plain باشد؛ در غیر این صورت null */
function toRecordOrNull(
  v: Prisma.JsonValue | null | undefined,
): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

/** اندازه فایل را به string | undefined نرمال می‌کند */
function toStringOrUndefined(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return v.toString();
  if (typeof v === 'bigint') return v.toString();
  return undefined;
}

export class ProductMapper {
  /** تبدیل مدل کامل به خروجی خلاصه برای لیست‌ها */
  static toBrief(p: ProductWithRelations): ProductBriefDto {
    const primarySupplier = p.supplierLinks?.[0]?.user;

    const creatorId = primarySupplier?.id ?? null;
    const creatorName = primarySupplier?.name ?? 'بدون نام';
    const creatorAvatarUrl = primarySupplier?.avatarUrl ?? null;

    return {
      id: String(p.id),
      slug: p.slug,
      title: p.title,
      coverUrl: p.coverUrl ?? undefined,

      graphicFormats: [...(p.graphicFormats ?? [])],
      colors: [...(p.colors ?? [])],
      pricingType: p.pricingType as PricingType,

      // اگر 0 هم معتبر است، از چک صریح استفاده کن
      price:
        p.price !== null && p.price !== undefined ? Number(p.price) : undefined,

      creatorId,
      creatorName,
      creatorAvatarUrl,

      status: p.status as ProductStatus,

      viewsCount: p.viewsCount,
      downloadsCount: p.downloadsCount,
      likesCount: p.likesCount,

      isLikedByCurrentUser: false,
      isBookmarkedByCurrentUser: false,

      shortLink: p.shortLink ?? undefined,

      seoKeywords: p.seoKeywords ?? undefined,
      seoTitle: p.seoTitle ?? undefined,
      seoDescription: p.seoDescription ?? undefined,

      fileSizeMB: p.fileSizeMB,
      fileBytes: p.fileBytes ? p.fileBytes.toString() : undefined,

      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  /** تبدیل مدل کامل به خروجی جزئیات */
  static toDetail(p: ProductWithRelations): ProductDetailDto {
    const brief = this.toBrief(p);

    const assets: ProductAssetDto[] = (p.assets ?? []).map((a: ProductAssetEntity) => ({
      id: String(a.id),
      url: a.url,
      alt: a.alt ?? undefined,
      order: a.sortOrder,
    }));

    const categories: ProductCategoryDto[] = (p.categoryLinks ?? []).map(
      (pc: ProductCategoryLinkEntity) => ({
        id: String(pc.category.id),
        name: pc.category.name,
        slug: pc.category.slug,
        parentId: pc.category.parentId
          ? String(pc.category.parentId)
          : undefined,
        coverUrl: pc.category.coverUrl ?? undefined,
      }),
    );

    const tags: ProductTagDto[] = (p.tagLinks ?? []).map((pt: ProductTagLinkEntity) => ({
      id: String(pt.tag.id),
      name: pt.tag.name,
      slug: pt.tag.slug,
    }));

    const authors: ProductAuthorDto[] = (p.supplierLinks ?? []).map(
      (ps: ProductSupplierLinkEntity) => ({
        userId: ps.userId,
        role: null as string | null,
      }),
    );

    const primarySupplierUser = p.supplierLinks?.[0]?.user;
    const author =
      primarySupplierUser !== undefined
        ? {
            id: primarySupplierUser.id,
            name: primarySupplierUser.name ?? 'بدون نام',
            avatarUrl: primarySupplierUser.avatarUrl ?? null,
            productsCount:
              primarySupplierUser._count?.productSuppliers ?? 0,
          }
        : undefined;

    const topics: ProductTopicDto[] = (p.topics ?? []).map((link: ProductTopicLinkEntity) => {
      const topicId = String(link.topicId);
      return {
        topicId,
        id: topicId,
        name: link.topic.name,
        slug: link.topic.slug,
        coverUrl: link.topic.coverUrl ?? undefined,
        order: link.order,
      };
    });

    const file: ProductFileDto | undefined = p.file
      ? {
          id: String(p.file.id),
          fileId: p.file.fileUuid ?? undefined,
          storageKey: p.file.storageKey,
          originalName: p.file.originalName ?? undefined,
          // ✅ اینجا string می‌خواهیم
          size: toStringOrUndefined(p.file.size),
          mimeType: p.file.mimeType ?? undefined,
          // ✅ به Record<string, unknown> | null نرمال شود تا با DTO سازگار باشد
          meta:
            p.file.meta === undefined
              ? undefined
              : toRecordOrNull(p.file.meta),
        }
      : undefined;

    return {
      ...brief,
      description: p.description ?? undefined,
      fileId: p.file?.fileUuid ?? undefined,
      assets,
      categories,
      tags,
      authors,
      author,
      topics,
      file,
    };
  }
}
