import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PricingType,
  ProductStatus,
  GraphicFormat,
} from '@prisma/client';
import { PrismaService } from '@app/prisma/prisma.service';
import type { PrismaTxClient } from '@app/prisma/prisma.service';
import { Buffer } from 'buffer';

import { CreateProductDto } from '@app/catalog/product/dtos/product-create.dto';
import { UpdateProductDto } from '@app/catalog/product/dtos/product-update.dto';
import {
  ProductFindQueryDto,
  ProductSearchQueryDto,
  ProductSort,
} from '@app/catalog/product/dtos/product-query.dto';
import {
  ProductBriefDto,
  ProductDetailDto,
  ProductListResultDto,
  ProductPaginatedResultDto,
  ProductSearchResultDto,
} from '@app/catalog/product/dtos/product-response.dto';
import { ProductFileInputDto } from '@app/catalog/product/dtos/product-shared.dto';
import { UserProductListQueryDto } from '@app/catalog/product/dtos/product-user-list-query.dto';

import {
  clampFaSlug,
  makeFaSlug,
  normalizeFaText,
  safeDecodeSlug,
} from '@shared-slug/slug/fa-slug.util';
import {
  clampPagination,
  toPaginationResult,
} from '@app/catalog/utils/pagination.util';
import {
  ProductMapper,
  productInclude,
  type ProductWithRelations,
} from '@app/catalog/product/product.mapper';

type ProductWithReactions = ProductWithRelations & {
  likes?: Array<{ productId: bigint }>;
  bookmarks?: Array<{ productId: bigint }>;
};

type ProductDetailInclude = typeof productInclude & {
  likes?: Prisma.Product$likesArgs;
  bookmarks?: Prisma.Product$bookmarksArgs;
};

export type Actor = { id: string; isAdmin: boolean };

const MAX_AUTHORS = 3;
const SHORT_LINK_PREFIX = 'p/';
const SHORT_LINK_RANDOM_DIGITS = 6;
const SHORT_LINK_MAX_LENGTH = 32;
const SHORT_LINK_MAX_ATTEMPTS = 10;
const PRODUCT_ENTITY_TYPE = 'product' as const;
const ACTIVE_PRODUCT_STATUSES: ProductStatus[] = [
  ProductStatus.DRAFT,
  ProductStatus.PUBLISHED,
];
const PRODUCT_TX_OPTIONS: Parameters<PrismaService['$transaction']>[1] = {
  maxWait: 5000,
  timeout: 20000,
};

type UploadedFileMeta = {
  id: string;
  path: string;
  filename: string;
  mime: string;
  size: bigint;
};

type FileInstruction =
  | { kind: 'none' }
  | { kind: 'disconnect' }
  | { kind: 'inline'; payload: ProductFileInputDto }
  | { kind: 'link-upload'; uploaded: UploadedFileMeta };

type TopicFilterInput = Pick<ProductFindQueryDto, 'topicId' | 'topicSlug'>;
type TagFilterInput = Pick<ProductFindQueryDto, 'tagId' | 'tagSlug'>;

type ProductFileMutationInput = {
  fileUuid: string | null;
  storageKey: string;
  originalName: string | null;
  size: bigint | null;
  mimeType: string | null;
  meta: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
};

function encodeCursor(obj: Record<string, string | number>): string {
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
function uniq<T>(arr: T[] | null | undefined): T[] {
  if (!arr) return [];
  return Array.from(new Set(arr));
}
function toBigIntNullable(id?: string): bigint | null {
  if (!id) return null;
  if (!/^\d+$/u.test(id)) return null;
  return BigInt(id);
}
export function toBigIntList(value?: string): bigint[] {
  if (!value) return [];
  const parts = value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

  const ids: bigint[] = [];
  for (const part of parts) {
    const parsed = toBigIntNullable(part);
    if (parsed !== null) ids.push(parsed);
  }
  return uniq(ids);
}
function parseBooleanFlag(value?: string): boolean | undefined {
  if (value === undefined) return undefined;
  return value === 'true';
}
function normalizeColorFilter(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/u.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function normalizeTagLabel(raw?: string): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\s+/g, ' ');
}

export function parseGraphicFormatList(raw?: string): GraphicFormat[] {
  if (!raw) return [];
  const parts = raw
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

  const formats = new Set<GraphicFormat>();
  const enumMap = GraphicFormat as unknown as Record<string, string>;
  for (const part of parts) {
    const upper = part.toUpperCase();
    if (enumMap[upper]) {
      formats.add(upper as GraphicFormat);
    }
  }
  return Array.from(formats);
}

function makeTagSearchWhere(term: string): Prisma.ProductWhereInput {
  return {
    tagLinks: {
      some: {
        tag: {
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { slug: { contains: term, mode: 'insensitive' } },
          ],
        },
      },
    },
  };
}

function makeTextWhere(q?: string): Prisma.ProductWhereInput | undefined {
  if (!q) return undefined;
  const term = normalizeFaText(q.trim());
  if (!term) return undefined;
  return {
    OR: [
      { title: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } },
      { slug: { contains: term, mode: 'insensitive' } },
      { seoTitle: { contains: term, mode: 'insensitive' } },
      { seoDescription: { contains: term, mode: 'insensitive' } },
      { shortLink: { contains: term, mode: 'insensitive' } },
      makeTagSearchWhere(term),
    ],
  };
}

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly logger = new Logger(ProductService.name);

  private buildProductDetailInclude(
    viewerId?: string,
  ): ProductDetailInclude {
    if (!viewerId) {
      return productInclude as ProductDetailInclude;
    }
    return {
      ...productInclude,
      likes: {
        where: { userId: viewerId },
        select: { productId: true },
      },
      bookmarks: {
        where: { userId: viewerId },
        select: { productId: true },
      },
    };
  }

  private getReactionFlags(product: ProductWithReactions) {
    return {
      isLikedByCurrentUser: (product.likes?.length ?? 0) > 0,
      isBookmarkedByCurrentUser: (product.bookmarks?.length ?? 0) > 0,
    };
  }

  private mapProductDetail(
    product: ProductWithReactions,
    viewerId?: string,
  ): ProductDetailDto {
    const dto = ProductMapper.toDetail(product);
    const reactions = this.getReactionFlags(product);
    this.logger.debug({
      context: 'ProductDetailFlags',
      step: 'beforeReturn',
      viewerId,
      productId: product.id.toString(),
      isLikedByCurrentUser: reactions.isLikedByCurrentUser,
      isBookmarkedByCurrentUser: reactions.isBookmarkedByCurrentUser,
    });
    dto.isLikedByCurrentUser = reactions.isLikedByCurrentUser;
    dto.isBookmarkedByCurrentUser = reactions.isBookmarkedByCurrentUser;
    return dto;
  }

  private async resolveUserReactions(
    productIds: bigint[],
    userId?: string,
    options?: { skipLiked?: boolean; skipBookmarked?: boolean },
  ): Promise<{ liked: Set<string>; bookmarked: Set<string> }> {
    const liked = new Set<string>();
    const bookmarked = new Set<string>();

    if (!userId || productIds.length === 0) {
      return { liked, bookmarked };
    }

    const tasks: Array<Promise<Array<{ productId: bigint }>>> = [];
    const resultOrder: Array<'like' | 'bookmark'> = [];

    if (!options?.skipLiked) {
      tasks.push(
        this.prisma.like.findMany({
          where: { userId, productId: { in: productIds } },
          select: { productId: true },
        }),
      );
      resultOrder.push('like');
    }

    if (!options?.skipBookmarked) {
      tasks.push(
        this.prisma.bookmark.findMany({
          where: { userId, productId: { in: productIds } },
          select: { productId: true },
        }),
      );
      resultOrder.push('bookmark');
    }

    const rows = await Promise.all(tasks);
    rows.forEach((row, index) => {
      const kind = resultOrder[index];
      if (kind === 'like') {
        row.forEach((item) => liked.add(item.productId.toString()));
      } else {
        row.forEach((item) => bookmarked.add(item.productId.toString()));
      }
    });

    return { liked, bookmarked };
  }

  async create(dto: CreateProductDto, actor: Actor): Promise<ProductDetailDto> {
    const title = normalizeFaText(dto.title);
    const slug = await this.ensureUniqueSlug(dto.slug ?? dto.title);
    const authors = this.resolveAuthors(dto.authorIds, actor);
    const categoryIds = uniq(dto.categoryIds ?? []).map((cid) => BigInt(cid));
    const tagIds = uniq(dto.tagIds ?? []).map((tid) => BigInt(tid));
    const topics = this.buildTopicLinks(dto.topics);
    const assetPayloads = this.buildAssetCreateInput(dto.assets);
    const fileInstruction = await this.resolveFileInstruction(
      dto.fileId,
      dto.file,
      false,
    );

    const createdId = await this.prisma.$transaction(async (trx: PrismaTxClient) => {
      const shortLink = await this.resolveShortLink(trx, dto.shortLink);
      const product = await trx.product.create({
        data: {
          slug,
          title,
          description: dto.description ?? null,
          coverUrl: dto.coverUrl ?? null,
          shortLink,
          graphicFormats: dto.graphicFormats ?? [],
          colors: dto.colors ?? [],
          seoTitle: dto.seoTitle ?? null,
          seoDescription: dto.seoDescription ?? null,
          seoKeywords: dto.seoKeywords ?? [],
          pricingType: dto.pricingType as PricingType,
          price: this.toDecimal(dto.price),
          status: (dto.status ?? ProductStatus.DRAFT) as ProductStatus,
          publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
          fileSizeMB: dto.fileSizeMB ?? 0,
          fileBytes:
            dto.fileBytes !== undefined && dto.fileBytes !== null
              ? BigInt(dto.fileBytes)
              : null,
          supplierLinks: {
            create: authors.map((userId) => ({ userId })),
          },
          categoryLinks: categoryIds.length
            ? {
                create: categoryIds.map((categoryId) => ({
                  categoryId,
                })),
              }
            : undefined,
          tagLinks: tagIds.length
            ? {
                create: tagIds.map((tagId) => ({
                  tagId,
                })),
              }
            : undefined,
          topics: topics.length
            ? {
                create: topics.map((topic) => ({
                  topicId: topic.topicId,
                  order: topic.order,
                })),
              }
            : undefined,
          assets: assetPayloads.length
            ? {
                create: assetPayloads,
              }
            : undefined,
        },
      });

      await this.applyFileInstruction(trx, product.id, fileInstruction);

      return product.id;
    }, PRODUCT_TX_OPTIONS);

    const created = await this.prisma.product.findUniqueOrThrow({
      where: { id: createdId },
      include: productInclude,
    });

    return ProductMapper.toDetail(created as ProductWithRelations);
  }

  async update(
    idOrSlug: string,
    dto: UpdateProductDto,
    actor: Actor,
  ): Promise<ProductDetailDto> {
    const product = await this.getByIdOrSlugStrict(idOrSlug);

    if (!(await this.canEdit(product.id, actor))) {
      throw new ForbiddenException('You are not allowed to edit this product.');
    }
    if (dto.authorIds !== undefined) {
      const authors = uniq(dto.authorIds);
      if (authors.length === 0) {
        throw new BadRequestException('At least one author is required.');
      }
      if (authors.length > MAX_AUTHORS) {
        throw new BadRequestException(
          `A product can have at most ${MAX_AUTHORS} authors.`,
        );
      }
    }

    const nextTitle =
      dto.title !== undefined ? normalizeFaText(dto.title) : undefined;
    const slugSource =
      dto.slug !== undefined
        ? dto.slug
        : dto.title !== undefined
          ? dto.title
          : undefined;
    const nextSlug = slugSource
      ? await this.ensureUniqueSlug(slugSource, product.id)
      : undefined;

    const fileInstruction = await this.resolveFileInstruction(
      dto.fileId ?? undefined,
      dto.file,
      true,
    );

    await this.prisma.$transaction(async (trx: PrismaTxClient) => {
      const resolvedShortLink =
        dto.shortLink !== undefined
          ? await this.resolveShortLink(trx, dto.shortLink, product.id)
          : undefined;

      const data: Prisma.ProductUpdateInput = {
        slug: nextSlug ?? undefined,
        title: nextTitle ?? undefined,
        description: dto.description ?? undefined,
        coverUrl: dto.coverUrl ?? undefined,
        shortLink: resolvedShortLink ?? undefined,
        seoTitle: dto.seoTitle ?? undefined,
        seoDescription: dto.seoDescription ?? undefined,
        seoKeywords: dto.seoKeywords ? { set: dto.seoKeywords } : undefined,
        pricingType: dto.pricingType ?? undefined,
        price:
          dto.price !== undefined
            ? dto.price === null
              ? null
              : this.toDecimal(dto.price)
            : undefined,
        status: dto.status ?? undefined,
        publishedAt:
          dto.publishedAt !== undefined
            ? dto.publishedAt
              ? new Date(dto.publishedAt)
              : null
            : undefined,
        graphicFormats:
          dto.graphicFormats !== undefined
            ? { set: dto.graphicFormats }
            : undefined,
        colors:
          dto.colors !== undefined ? { set: dto.colors ?? [] } : undefined,
        fileSizeMB:
          dto.fileSizeMB !== undefined ? (dto.fileSizeMB ?? 0) : undefined,
        fileBytes:
          dto.fileBytes !== undefined
            ? dto.fileBytes === null
              ? null
              : BigInt(dto.fileBytes)
            : undefined,
      };

      if (dto.authorIds !== undefined) {
        const authors = uniq(dto.authorIds);
        if (authors.length === 0) {
          throw new BadRequestException('At least one author is required.');
        }
        await trx.productSupplier.deleteMany({
          where: { productId: product.id },
        });
        await trx.productSupplier.createMany({
          data: authors.map((userId) => ({ productId: product.id, userId })),
          skipDuplicates: true,
        });
      }

      if (dto.categoryIds) {
        const categoryIds = uniq(dto.categoryIds).map((cid) => BigInt(cid));
        await trx.productCategory.deleteMany({
          where: {
            productId: product.id,
            NOT: { categoryId: { in: categoryIds } },
          },
        });
        const existing = await trx.productCategory.findMany({
          where: { productId: product.id },
          select: { categoryId: true },
        });
        const existingIds = new Set(
          existing.map((x: { categoryId: bigint }) => x.categoryId),
        );
        const toCreate = categoryIds.filter((id) => !existingIds.has(id));
        if (toCreate.length > 0) {
          await trx.productCategory.createMany({
            data: toCreate.map((categoryId) => ({
              productId: product.id,
              categoryId,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (dto.tagIds) {
        const tagIds = uniq(dto.tagIds).map((tid) => BigInt(tid));
        await trx.productTag.deleteMany({
          where: { productId: product.id, NOT: { tagId: { in: tagIds } } },
        });
        const existing = await trx.productTag.findMany({
          where: { productId: product.id },
          select: { tagId: true },
        });
        const existingIds = new Set(
          existing.map((x: { tagId: bigint }) => x.tagId),
        );
        const toCreate = tagIds.filter((id) => !existingIds.has(id));
        if (toCreate.length > 0) {
          await trx.productTag.createMany({
            data: toCreate.map((tagId) => ({ productId: product.id, tagId })),
            skipDuplicates: true,
          });
        }
      }

      if (dto.topics) {
        await trx.productTopic.deleteMany({ where: { productId: product.id } });
        const nextTopics = this.buildTopicLinks(dto.topics);
        if (nextTopics.length > 0) {
          await trx.productTopic.createMany({
            data: nextTopics.map((topic) => ({
              productId: product.id,
              topicId: topic.topicId,
              order: topic.order,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (dto.assets) {
        await trx.productAsset.deleteMany({ where: { productId: product.id } });
        const nextAssets = this.buildAssetCreateInput(dto.assets);
        if (nextAssets.length > 0) {
          await trx.productAsset.createMany({
            data: nextAssets.map((asset) => ({
              productId: product.id,
              url: asset.url,
              alt: asset.alt,
              sortOrder: asset.sortOrder,
            })),
          });
        }
      }

      await trx.product.update({
        where: { id: product.id },
        data,
      });
      if (nextSlug && nextSlug !== product.slug) {
        await this.createSlugRedirect(trx, product.id, product.slug, nextSlug);
      }
      await this.applyFileInstruction(trx, product.id, fileInstruction);
    }, PRODUCT_TX_OPTIONS);

    const updated = await this.prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      include: productInclude,
    });

    return ProductMapper.toDetail(updated as ProductWithRelations);
  }

  async findByIdOrSlug(
    idOrSlug: string,
    viewerId?: string,
  ): Promise<ProductDetailDto> {
    const include = this.buildProductDetailInclude(viewerId);
    const product = (await this.prisma.product.findFirst({
      where: this.withActiveStatus(this.idOrSlugWhere(idOrSlug)),
      include,
    })) as ProductWithReactions | null;
    if (!product) throw new NotFoundException('Product not found');
    const withReactions = product as unknown as ProductWithReactions;
    this.logger.debug({
      context: 'ProductDetailFlags',
      step: 'afterQuery',
      viewerId,
      productId: withReactions.id.toString(),
      likesCount: withReactions.likes?.length ?? 0,
      bookmarksCount: withReactions.bookmarks?.length ?? 0,
    });
    return this.mapProductDetail(withReactions, viewerId);
  }

  async findByShortCode(
    code: string,
    viewerId?: string,
  ): Promise<ProductDetailDto> {
    const shortLink = this.normalizeShortCode(code);
    const product = await this.prisma.product.findUnique({
      where: { shortLink },
      include: this.buildProductDetailInclude(viewerId),
    });
    if (!product || !this.isActiveStatus(product.status)) {
      throw new NotFoundException('Product not found');
    }
    const withReactions = product as unknown as ProductWithReactions;
    this.logger.debug({
      context: 'ProductDetailFlags',
      step: 'afterQuery',
      viewerId,
      productId: withReactions.id.toString(),
      likesCount: withReactions.likes?.length ?? 0,
      bookmarksCount: withReactions.bookmarks?.length ?? 0,
    });
    return this.mapProductDetail(withReactions, viewerId);
  }

  async findForRoute(
    idOrSlug: string,
    viewerId?: string,
  ): Promise<{ product?: ProductDetailDto; redirectTo?: string }> {
    this.logger.debug({
      context: 'ProductDetailFlags',
      step: 'findForRoute:start',
      idOrSlug,
      viewerId,
      isNumeric: /^\d+$/u.test(idOrSlug),
    });
    if (/^\d+$/u.test(idOrSlug)) {
      const product = await this.findByIdOrSlug(idOrSlug, viewerId);
      return { product };
    }
    const normalizedSlug = normalizeFaText(safeDecodeSlug(idOrSlug));
    return this.findBySlug(normalizedSlug, viewerId);
  }

  async findBySlug(
    slug: string,
    viewerId?: string,
  ): Promise<{ product?: ProductDetailDto; redirectTo?: string }> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: this.buildProductDetailInclude(viewerId),
    });
    if (product && this.isActiveStatus(product.status)) {
      const withReactions = product as unknown as ProductWithReactions;
      this.logger.debug({
        context: 'ProductDetailFlags',
        step: 'afterQuery',
        viewerId,
        productId: withReactions.id.toString(),
        likesCount: withReactions.likes?.length ?? 0,
        bookmarksCount: withReactions.bookmarks?.length ?? 0,
      });
      return {
        product: this.mapProductDetail(withReactions, viewerId),
      };
    }
    const redirect = await this.prisma.slugRedirect.findUnique({
      where: { fromSlug: slug },
      select: { entityType: true, toSlug: true },
    });
    if (redirect?.entityType === PRODUCT_ENTITY_TYPE) {
      return { redirectTo: redirect.toSlug };
    }
    throw new NotFoundException('Product not found');
  }

  async findAll(
    query: ProductFindQueryDto,
    viewerId?: string,
  ): Promise<ProductListResultDto> {
    const limit = Math.min(Math.max(query.limit ?? 24, 1), 60);
    const sort: ProductSort = (query.sort ?? 'latest') as ProductSort;
    const topicFilter = await this.resolveTopicFilter(query);
    if (topicFilter.slugNotFound) {
      return { items: [], nextCursor: undefined };
    }
    const tagFilter = await this.resolveTagFilter(query);
    if (tagFilter.slugNotFound) {
      return { items: [], nextCursor: undefined };
    }

    const ands: Prisma.ProductWhereInput[] = [];
    const text = makeTextWhere(query.q);
    if (text) ands.push(text);

    if (query.pricingType)
      ands.push({ pricingType: query.pricingType as PricingType });
    const graphicFormats = parseGraphicFormatList(query.graphicFormat);
    if (graphicFormats.length) {
      ands.push({
        graphicFormats: {
          hasSome: graphicFormats,
        },
      });
    }
    if (query.status) {
      ands.push({ status: query.status as ProductStatus });
    } else {
      ands.push({ status: { in: ACTIVE_PRODUCT_STATUSES } });
    }

    const colorFilter = normalizeColorFilter(query.color);
    if (colorFilter) {
      ands.push({ colors: { has: colorFilter } });
    }

    if (query.categoryId) {
      const cids = toBigIntList(query.categoryId);
      if (cids.length) {
        ands.push({
          categoryLinks: {
            some: { categoryId: { in: cids } },
          },
        });
      }
    }
    if (tagFilter.tagIds.length) {
      ands.push({
        tagLinks: {
          some: { tagId: { in: tagFilter.tagIds } },
        },
      });
    }
    if (query.tagName) {
      const tagName = normalizeTagLabel(query.tagName);
      if (tagName) {
        const normalized = normalizeFaText(tagName);
        if (normalized) {
          ands.push({
            tagLinks: {
              some: {
                tag: {
                  name: { contains: normalized, mode: 'insensitive' },
                },
              },
            },
          });
        }
      }
    }
    if (topicFilter.topicIds.length) {
      ands.push({
        topics: {
          some: { topicId: { in: topicFilter.topicIds } },
        },
      });
    }
    if (query.authorId) {
      ands.push({ supplierLinks: { some: { userId: query.authorId } } });
    }

    const hasFile = parseBooleanFlag(query.hasFile);
    if (hasFile !== undefined) {
      ands.push(
        hasFile ? { file: { isNot: null } } : { file: { is: null } },
      );
    }

    const hasAssets = parseBooleanFlag(query.hasAssets);
    if (hasAssets !== undefined) {
      ands.push(
        hasAssets ? { assets: { some: {} } } : { assets: { none: {} } },
      );
    }

    const baseWhere: Prisma.ProductWhereInput = ands.length
      ? { AND: ands }
      : {};

    type LatestCursor = { createdAt: string; id: string };
    type CountCursor = { primary: number; id: string };

    let orderBy: Prisma.ProductOrderByWithRelationInput[] = [];
    let cursorWhere: Prisma.ProductWhereInput | undefined;

    if (sort === 'latest') {
      orderBy = [{ createdAt: 'desc' }, { id: 'desc' }];
      const c = decodeCursor<LatestCursor>(query.cursor);
      if (c) {
        const createdAt = new Date(c.createdAt);
        const id = BigInt(c.id);
        cursorWhere = {
          OR: [
            { createdAt: { lt: createdAt } },
            { AND: [{ createdAt }, { id: { lt: id } }] },
          ],
        };
      }
    } else if (sort === 'popular') {
      orderBy = [
        { downloadsCount: 'desc' },
        { likesCount: 'desc' },
        { id: 'desc' },
      ];
      const c = decodeCursor<CountCursor>(query.cursor);
      if (c) {
        const primary = Number(c.primary);
        const id = BigInt(c.id);
        cursorWhere = {
          OR: [
            { downloadsCount: { lt: primary } },
            { AND: [{ downloadsCount: primary }, { id: { lt: id } }] },
          ],
        };
      }
    } else if (sort === 'viewed') {
      orderBy = [{ viewsCount: 'desc' }, { id: 'desc' }];
      const c = decodeCursor<CountCursor>(query.cursor);
      if (c) {
        const primary = Number(c.primary);
        const id = BigInt(c.id);
        cursorWhere = {
          OR: [
            { viewsCount: { lt: primary } },
            { AND: [{ viewsCount: primary }, { id: { lt: id } }] },
          ],
        };
      }
    } else if (sort === 'liked') {
      orderBy = [{ likesCount: 'desc' }, { id: 'desc' }];
      const c = decodeCursor<CountCursor>(query.cursor);
      if (c) {
        const primary = Number(c.primary);
        const id = BigInt(c.id);
        cursorWhere = {
          OR: [
            { likesCount: { lt: primary } },
            { AND: [{ likesCount: primary }, { id: { lt: id } }] },
          ],
        };
      }
    }

    const finalWhere: Prisma.ProductWhereInput = cursorWhere
      ? { AND: [baseWhere, cursorWhere] }
      : baseWhere;

    const rows = await this.prisma.product.findMany({
      where: finalWhere,
      orderBy,
      take: limit,
      include: productInclude,
    });

    const reactions = await this.resolveUserReactions(
      rows.map((r) => r.id),
      viewerId,
    );

    const items: ProductBriefDto[] = (rows as ProductWithRelations[]).map(
      (p) => {
        const brief = ProductMapper.toBrief(p);
        brief.isLikedByCurrentUser = reactions.liked.has(p.id.toString());
        brief.isBookmarkedByCurrentUser = reactions.bookmarked.has(
          p.id.toString(),
        );
        return brief;
      },
    );

    let nextCursor: string | undefined;
    if (rows.length === limit) {
      const last = rows[rows.length - 1] as ProductWithRelations;
      if (sort === 'latest') {
        nextCursor = encodeCursor({
          createdAt: last.createdAt.toISOString(),
          id: String(last.id),
        });
      } else if (sort === 'popular') {
        nextCursor = encodeCursor({
          primary: last.downloadsCount,
          id: String(last.id),
        });
      } else if (sort === 'viewed') {
        nextCursor = encodeCursor({
          primary: last.viewsCount,
          id: String(last.id),
        });
      } else if (sort === 'liked') {
        nextCursor = encodeCursor({
          primary: last.likesCount,
          id: String(last.id),
        });
      }
    }

    return { items, nextCursor };
  }

  async findRelated(
    idOrSlug: string,
    limit?: number,
    viewerId?: string,
  ): Promise<ProductBriefDto[]> {
    const safeLimit = Math.min(Math.max(limit ?? 12, 1), 24);
    const product = await this.getByIdOrSlugStrict(idOrSlug);
    const tagIds = uniq(
      (product.tagLinks ?? []).map((link) => link.tagId as bigint),
    );
    if (!tagIds.length) return [];

    const statusList = Prisma.join(
      ACTIVE_PRODUCT_STATUSES.map((status) => Prisma.sql`${status}`),
    );
    const tagList = Prisma.join(tagIds.map((tagId) => Prisma.sql`${tagId}`));

    const relatedRows = await this.prisma.$queryRaw<
      Array<{ id: bigint; match_count: bigint }>
    >(Prisma.sql`
      SELECT p.id, COUNT(pt."tag_id") AS match_count
      FROM "catalog"."products" p
      JOIN "catalog"."product_tags" pt ON pt."product_id" = p.id
      WHERE p."status"::text IN (${statusList})
        AND p.id <> ${product.id}
        AND pt."tag_id" IN (${tagList})
      GROUP BY p.id
      ORDER BY match_count DESC, p."createdAt" DESC, p.id DESC
      LIMIT ${safeLimit}
    `);

    const ids = relatedRows.map((row) => row.id);
    if (!ids.length) return [];

    const rows = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: productInclude,
    });
    const order = new Map(ids.map((id, index) => [id.toString(), index]));
    rows.sort(
      (a, b) =>
        (order.get(a.id.toString()) ?? 0) -
        (order.get(b.id.toString()) ?? 0),
    );

    const reactions = await this.resolveUserReactions(ids, viewerId);

    return (rows as ProductWithRelations[]).map((p) => {
      const brief = ProductMapper.toBrief(p);
      brief.isLikedByCurrentUser = reactions.liked.has(p.id.toString());
      brief.isBookmarkedByCurrentUser = reactions.bookmarked.has(
        p.id.toString(),
      );
      return brief;
    });
  }

  async search(
    query: ProductSearchQueryDto,
    viewerId?: string,
  ): Promise<ProductSearchResultDto> {
    const term = normalizeFaText(query.q);
    if (!term || term.length < 2) {
      throw new BadRequestException('Search text must be at least 2 characters long.');
    }

    const sort: ProductSort = (query.sort ?? 'latest') as ProductSort;
    const { page, limit, skip } = clampPagination(
      query.page,
      query.limit ?? 20,
      50,
    );
    const topicFilter = await this.resolveTopicFilter(query);
    if (topicFilter.slugNotFound) {
      const empty = toPaginationResult<ProductBriefDto>([], 0, page, limit);
      return {
        items: empty.data,
        total: empty.total,
        page: empty.page,
        limit: empty.limit,
        hasNext: empty.hasNext,
      };
    }
    const tagFilter = await this.resolveTagFilter(query);
    if (tagFilter.slugNotFound) {
      const empty = toPaginationResult<ProductBriefDto>([], 0, page, limit);
      return {
        items: empty.data,
        total: empty.total,
        page: empty.page,
        limit: empty.limit,
        hasNext: empty.hasNext,
      };
    }
    const likeTerm = `%${term}%`;
    const startsWithTerm = `${term}%`;

    const statuses = query.status
      ? [query.status as ProductStatus]
      : ACTIVE_PRODUCT_STATUSES;
    const statusList = Prisma.join(
      statuses.map((status) => Prisma.sql`${status}`),
    );

    const conditions: Prisma.Sql[] = [
      Prisma.sql`p."status"::text IN (${statusList})`,
    ];

    if (query.pricingType) {
      conditions.push(
        Prisma.sql`p."pricingType"::text = ${query.pricingType as PricingType}`,
      );
    }

    const graphicFormats = parseGraphicFormatList(query.graphicFormat);
    if (graphicFormats.length) {
      conditions.push(
        Prisma.sql`p."graphicFormats" && ARRAY[${Prisma.join(
          graphicFormats.map((format) => Prisma.sql`${format}`),
        )}]::"catalog"."enum_content_products_graphicFormat"[]`,
      );
    }

    const colorFilter = normalizeColorFilter(query.color);
    if (colorFilter) {
      conditions.push(
        Prisma.sql`p."colors" @> ARRAY[${colorFilter}]::text[]`,
      );
    }

    const categoryIds = toBigIntList(query.categoryId);
    if (categoryIds.length) {
      conditions.push(
        Prisma.sql`EXISTS (
          SELECT 1 FROM "catalog"."product_categories" pc
          WHERE pc."product_id" = p.id
            AND pc."category_id" IN (${Prisma.join(
              categoryIds.map((categoryId) => Prisma.sql`${categoryId}`),
            )})
        )`,
      );
    }

    const tagIds = tagFilter.tagIds;
    if (tagIds.length) {
      conditions.push(
        Prisma.sql`EXISTS (
          SELECT 1 FROM "catalog"."product_tags" pt
          WHERE pt."product_id" = p.id
            AND pt."tag_id" IN (${Prisma.join(
              tagIds.map((tagId) => Prisma.sql`${tagId}`),
            )})
        )`,
      );
    }

    if (query.tagName) {
      const normalizedTag = normalizeTagLabel(query.tagName);
      if (normalizedTag) {
        const tagTerm = normalizeFaText(normalizedTag);
        if (tagTerm) {
          const explicitTagLike = `%${tagTerm}%`;
          conditions.push(
            Prisma.sql`EXISTS (
              SELECT 1 FROM "catalog"."product_tags" pt
              JOIN "catalog"."tags" t ON t.id = pt."tag_id"
              WHERE pt."product_id" = p.id
                AND t.name ILIKE ${explicitTagLike}
            )`,
          );
        }
      }
    }

    if (topicFilter.topicIds.length) {
      conditions.push(
        Prisma.sql`EXISTS (
          SELECT 1 FROM "catalog"."product_topics" ptop
          WHERE ptop."product_id" = p.id
            AND ptop."topic_id" IN (${Prisma.join(
              topicFilter.topicIds.map((topicId) => Prisma.sql`${topicId}`),
            )})
        )`,
      );
    }

    if (query.authorId) {
      conditions.push(
        Prisma.sql`EXISTS (
          SELECT 1 FROM "catalog"."product_suppliers" ps
          WHERE ps."product_id" = p.id AND ps."user_id" = ${query.authorId}
        )`,
      );
    }

    const hasFile = parseBooleanFlag(query.hasFile);
    if (hasFile !== undefined) {
      conditions.push(
        hasFile
          ? Prisma.sql`EXISTS (
              SELECT 1 FROM "catalog"."product_files" pf WHERE pf."product_id" = p.id
            )`
          : Prisma.sql`NOT EXISTS (
              SELECT 1 FROM "catalog"."product_files" pf WHERE pf."product_id" = p.id
            )`,
      );
    }

    const hasAssets = parseBooleanFlag(query.hasAssets);
    if (hasAssets !== undefined) {
      conditions.push(
        hasAssets
          ? Prisma.sql`EXISTS (
              SELECT 1 FROM "catalog"."product_assets" pa WHERE pa."product_id" = p.id
            )`
          : Prisma.sql`NOT EXISTS (
              SELECT 1 FROM "catalog"."product_assets" pa WHERE pa."product_id" = p.id
            )`,
      );
    }

    const tagMatchClause = Prisma.sql`
      EXISTS (
        SELECT 1
        FROM "catalog"."product_tags" spt
        JOIN "catalog"."tags" st ON st.id = spt."tag_id"
        WHERE spt."product_id" = p.id
          AND (
            st.name ILIKE ${likeTerm}
            OR st.slug ILIKE ${likeTerm}
          )
      )
    `;

    conditions.push(
      Prisma.sql`(
        p.title ILIKE ${likeTerm}
        OR p."description" ILIKE ${likeTerm}
        OR ${tagMatchClause}
      )`,
    );

    const whereClause =
      conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(
            conditions,
            ' AND ',
          )}`
        : Prisma.sql``;

    const scoreExpression = Prisma.sql`
      (CASE WHEN p.title ILIKE ${startsWithTerm} THEN 4 ELSE 0 END)
      + (CASE WHEN p.title ILIKE ${likeTerm} THEN 2 ELSE 0 END)
      + (CASE WHEN p."description" ILIKE ${likeTerm} THEN 1 ELSE 0 END)
      + (CASE WHEN ${tagMatchClause} THEN 3 ELSE 0 END)
    `;

    const secondaryOrder = (() => {
      if (sort === 'popular') {
        return Prisma.sql`p."downloadsCount" DESC, p."likesCount" DESC, p."createdAt" DESC, p.id DESC`;
      }
      if (sort === 'viewed') {
        return Prisma.sql`p."viewsCount" DESC, p."createdAt" DESC, p.id DESC`;
      }
      if (sort === 'liked') {
        return Prisma.sql`p."likesCount" DESC, p."createdAt" DESC, p.id DESC`;
      }
      return Prisma.sql`p."createdAt" DESC, p.id DESC`;
    })();

    const orderByClause = Prisma.sql`ORDER BY score DESC, ${secondaryOrder}`;

    const rows = await this.prisma.$queryRaw<
      Array<{ id: bigint; score: number }>
    >(Prisma.sql`
      SELECT p.id, ${scoreExpression} AS score
      FROM "catalog"."products" p
      ${whereClause}
      ${orderByClause}
      LIMIT ${limit} OFFSET ${skip}
    `);

    const ids = rows.map((row) => row.id);

    const countResult = await this.prisma.$queryRaw<
      Array<{ count: bigint }>
    >(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "catalog"."products" p
      ${whereClause}
    `);

    const total = Number(countResult?.[0]?.count ?? 0);
    if (!ids.length) {
      const emptyPagination = toPaginationResult<ProductBriefDto>(
        [],
        total,
        page,
        limit,
      );
      return {
        items: emptyPagination.data,
        total: emptyPagination.total,
        page: emptyPagination.page,
        limit: emptyPagination.limit,
        hasNext: emptyPagination.hasNext,
      };
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: productInclude,
    });
    const order = new Map(ids.map((id, index) => [id.toString(), index]));
    products.sort(
      (a, b) =>
        (order.get(a.id.toString()) ?? 0) -
        (order.get(b.id.toString()) ?? 0),
    );
    const reactions = await this.resolveUserReactions(ids, viewerId);
    const items = (products as ProductWithRelations[]).map((p) => {
      const brief = ProductMapper.toBrief(p);
      brief.isLikedByCurrentUser = reactions.liked.has(p.id.toString());
      brief.isBookmarkedByCurrentUser = reactions.bookmarked.has(
        p.id.toString(),
      );
      return brief;
    });

    const pagination = toPaginationResult(items, total, page, limit);
    return {
      items: pagination.data,
      total: pagination.total,
      page: pagination.page,
      limit: pagination.limit,
      hasNext: pagination.hasNext,
    };
  }

  async listLikedByUser(
    userId: string,
    query: UserProductListQueryDto,
  ): Promise<ProductPaginatedResultDto> {
    const { page, limit, skip } = clampPagination(
      query.page,
      query.limit ?? 20,
      50,
    );

    type LikeWithProduct = Prisma.LikeGetPayload<{
      include: { product: { include: typeof productInclude } };
    }>;

    const [likes, total] = await this.prisma.$transaction([
      this.prisma.like.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { productId: 'desc' }],
        skip,
        take: limit,
        include: { product: { include: productInclude } },
      }),
      this.prisma.like.count({ where: { userId } }),
    ]);

    const productIds = likes.map((l) => l.productId);
    const reactions = await this.resolveUserReactions(productIds, userId, {
      skipLiked: true,
    });

    const items = (likes as LikeWithProduct[]).map((like) => {
      const brief = ProductMapper.toBrief(
        like.product as unknown as ProductWithRelations,
      );
      brief.isLikedByCurrentUser = true;
      brief.isBookmarkedByCurrentUser = reactions.bookmarked.has(
        like.productId.toString(),
      );
      return brief;
    });

    const pagination = toPaginationResult(items, total, page, limit);
    return {
      items: pagination.data,
      total: pagination.total,
      page: pagination.page,
      limit: pagination.limit,
      hasNext: pagination.hasNext,
    };
  }

  async listBookmarkedByUser(
    userId: string,
    query: UserProductListQueryDto,
  ): Promise<ProductPaginatedResultDto> {
    const { page, limit, skip } = clampPagination(
      query.page,
      query.limit ?? 20,
      50,
    );

    type BookmarkWithProduct = Prisma.BookmarkGetPayload<{
      include: { product: { include: typeof productInclude } };
    }>;

    const [bookmarks, total] = await this.prisma.$transaction([
      this.prisma.bookmark.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { productId: 'desc' }],
        skip,
        take: limit,
        include: { product: { include: productInclude } },
      }),
      this.prisma.bookmark.count({ where: { userId } }),
    ]);

    const productIds = bookmarks.map((b) => b.productId);
    const reactions = await this.resolveUserReactions(productIds, userId, {
      skipBookmarked: true,
    });

    const items = (bookmarks as BookmarkWithProduct[]).map((bookmark) => {
      const brief = ProductMapper.toBrief(
        bookmark.product as unknown as ProductWithRelations,
      );
      brief.isBookmarkedByCurrentUser = true;
      brief.isLikedByCurrentUser = reactions.liked.has(
        bookmark.productId.toString(),
      );
      return brief;
    });

    const pagination = toPaginationResult(items, total, page, limit);
    return {
      items: pagination.data,
      total: pagination.total,
      page: pagination.page,
      limit: pagination.limit,
      hasNext: pagination.hasNext,
    };
  }

  async remove(idOrSlug: string, actor: Actor): Promise<ProductDetailDto> {
    const product = await this.getByIdOrSlugStrict(idOrSlug);
    if (!(await this.canEdit(product.id, actor))) {
      throw new ForbiddenException(
        'You are not allowed to remove this product.',
      );
    }
    const updated = await this.prisma.product.update({
      where: { id: product.id },
      data: { status: ProductStatus.ARCHIVED },
      include: productInclude,
    });
    return ProductMapper.toDetail(updated as ProductWithRelations);
  }

  async toggleLike(
    productIdStr: string,
    userId: string,
  ): Promise<{ productId: string; liked: boolean; likesCount: number }> {
    const productId = toBigIntNullable(productIdStr);
    if (productId === null) throw new BadRequestException('Invalid product id');

    const existed = await this.prisma.like.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existed) {
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
        this.prisma.like.create({ data: { userId, productId } }),
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
      liked: !existed,
      likesCount: product?.likesCount ?? 0,
    };
  }

  async toggleBookmark(
    productIdStr: string,
    userId: string,
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
    } else {
      await this.prisma.bookmark.create({ data: { userId, productId } });
    }

    return { productId: productId.toString(), bookmarked: !existed };
  }

  async incrementView(
    productId: bigint,
    viewerId?: string,
    ip?: string,
    ua?: string,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: productId },
        data: { viewsCount: { increment: 1 } },
      }),
      this.prisma.productView.create({
        data: {
          productId,
          userId: viewerId ?? undefined,
          ip: ip ?? null,
          ua: ua ?? null,
        },
      }),
    ]);
  }

  async registerDownload(
    productIdStr: string,
    userId: string,
    bytes?: number,
    pricePaid?: number,
    ip?: string,
  ): Promise<void> {
    const productId = toBigIntNullable(productIdStr);
    if (productId === null) throw new BadRequestException('Invalid product id');

    await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: productId },
        data: { downloadsCount: { increment: 1 } },
      }),
      this.prisma.productDownload.create({
        data: {
          productId,
          userId,
          bytes: bytes !== undefined ? BigInt(bytes) : null,
          pricePaid: pricePaid ?? null,
          ip: ip ?? null,
        },
      }),
    ]);
  }

  private async canEdit(productId: bigint, actor: Actor): Promise<boolean> {
    if (actor.isAdmin) return true;
    const link = await this.prisma.productSupplier.findFirst({
      where: { productId, userId: actor.id },
      select: { productId: true },
    });
    return !!link;
  }

  private async getByIdOrSlugStrict(idOrSlug: string) {
    const where = this.withActiveStatus(this.idOrSlugWhere(idOrSlug));
    const prod = await this.prisma.product.findFirst({
      where,
      include: productInclude,
    });
    if (!prod) throw new NotFoundException('Product not found');
    return prod as ProductWithRelations;
  }

  private idOrSlugWhere(idOrSlug: string): Prisma.ProductWhereInput {
    if (/^\d+$/u.test(idOrSlug)) {
      return { id: BigInt(idOrSlug) };
    }
    return { slug: normalizeFaText(safeDecodeSlug(idOrSlug)) };
  }

  private withActiveStatus(
    where: Prisma.ProductWhereInput,
  ): Prisma.ProductWhereInput {
    return {
      AND: [
        where,
        { status: { in: ACTIVE_PRODUCT_STATUSES } },
      ],
    };
  }

  private isActiveStatus(status: ProductStatus): boolean {
    return ACTIVE_PRODUCT_STATUSES.includes(status);
  }

  private async resolveFileInstruction(
    fileId: string | null | undefined,
    file: ProductFileInputDto | undefined,
    allowDisconnect: boolean,
  ): Promise<FileInstruction> {
    if (fileId === null) {
      if (!allowDisconnect) {
        throw new BadRequestException('fileId cannot be null in this context.');
      }
      if (file) {
        throw new BadRequestException('Provide either fileId or file, not both.');
      }
      return { kind: 'disconnect' };
    }
    if (file && fileId !== undefined) {
      throw new BadRequestException('Provide either fileId or file, not both.');
    }
    if (file) {
      return { kind: 'inline', payload: file };
    }
    if (fileId === undefined) {
      return { kind: 'none' };
    }
    const trimmed = fileId.trim();
    if (!trimmed) {
      throw new BadRequestException('fileId must be a non-empty string');
    }
    const uploaded = await this.prisma.file.findUnique({
      where: { id: trimmed },
      select: { id: true, path: true, filename: true, mime: true, size: true },
    });
    if (!uploaded) {
      throw new BadRequestException('Invalid fileId: file not found');
    }
    return { kind: 'link-upload', uploaded };
  }

  private async applyFileInstruction(
    trx: PrismaTxClient,
    productId: bigint,
    instruction: FileInstruction,
  ): Promise<void> {
    switch (instruction.kind) {
      case 'none':
        return;
      case 'disconnect':
        try {
          await trx.productFile.delete({ where: { productId } });
        } catch (error: unknown) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
            throw error;
          }
          if (error.code === 'P2025') {
            return;
          }
          throw error;
        }
        return;
      case 'inline': {
        const payload = this.mapInlineFileInput(instruction.payload);
        await trx.productFile.upsert({
          where: { productId },
          update: payload,
          create: { productId, ...payload },
        });
        return;
      }
      case 'link-upload': {
        const payload = this.mapUploadedFileInput(instruction.uploaded);
        await trx.productFile.upsert({
          where: { productId },
          update: payload,
          create: { productId, ...payload },
        });
        return;
      }
      default:
        return;
    }
  }

  private mapInlineFileInput(file: ProductFileInputDto): ProductFileMutationInput {
    return {
      fileUuid: null,
      storageKey: file.storageKey,
      originalName: file.originalName ?? null,
      size:
        file.size !== undefined && file.size !== null
          ? BigInt(file.size)
          : null,
      mimeType: file.mimeType ?? null,
      meta:
        file.meta === undefined || file.meta === null
          ? Prisma.JsonNull
          : (file.meta as Prisma.InputJsonValue),
    };
  }

  private mapUploadedFileInput(uploaded: UploadedFileMeta): ProductFileMutationInput {
    return {
      fileUuid: uploaded.id,
      storageKey: uploaded.path,
      originalName: uploaded.filename,
      size: uploaded.size,
      mimeType: uploaded.mime,
      meta: Prisma.JsonNull,
    };
  }

  private async resolveShortLink(
    trx: PrismaTxClient,
    requested?: string | null,
    ignoreId?: bigint,
  ): Promise<string> {
    if (requested !== undefined && requested !== null) {
      const normalized = requested.trim();
      if (!normalized) {
        throw new BadRequestException('shortLink cannot be empty');
      }
      if (normalized.length > SHORT_LINK_MAX_LENGTH) {
        throw new BadRequestException(
          `shortLink must be at most ${SHORT_LINK_MAX_LENGTH} characters.`,
        );
      }
      await this.assertShortLinkUnique(trx, normalized, ignoreId);
      return normalized;
    }
    for (let attempt = 0; attempt < SHORT_LINK_MAX_ATTEMPTS; attempt += 1) {
      const candidate = this.makeNumericShortLink();
      const existing = await trx.product.findUnique({
        where: { shortLink: candidate },
        select: { id: true },
      });
      if (!existing) {
        return candidate;
      }
    }
    throw new InternalServerErrorException(
      'Failed to allocate short link, please retry later.',
    );
  }

  private async assertShortLinkUnique(
    trx: PrismaTxClient,
    shortLink: string,
    ignoreId?: bigint,
  ): Promise<void> {
    const existing = await trx.product.findUnique({
      where: { shortLink },
      select: { id: true },
    });
    if (existing && (!ignoreId || existing.id !== ignoreId)) {
      throw new BadRequestException('shortLink already in use');
    }
  }

  private makeNumericShortLink(): string {
    let digits = '';
    for (let i = 0; i < SHORT_LINK_RANDOM_DIGITS; i += 1) {
      digits += Math.floor(Math.random() * 10).toString();
    }
    return `${SHORT_LINK_PREFIX}${digits}`;
  }

  private resolveAuthors(
    authorIds: string[] | undefined,
    actor: Actor,
  ): string[] {
    const authors = uniq(authorIds ?? []);
    if (authors.length === 0) {
      authors.push(actor.id);
    }
    if (authors.length > MAX_AUTHORS) {
      throw new BadRequestException(
        `A product can have at most ${MAX_AUTHORS} authors.`,
      );
    }
    return authors;
  }

  private buildAssetCreateInput(
    assets: CreateProductDto['assets'] | UpdateProductDto['assets'],
  ): Array<{ url: string; alt: string | null; sortOrder: number }> {
    if (!assets) return [];
    return assets.map((asset, index) => ({
      url: asset.url,
      alt: asset.alt ?? null,
      sortOrder:
        asset.order !== undefined && asset.order !== null ? asset.order : index,
    }));
  }

  private async resolveTopicFilter(
    query: TopicFilterInput,
  ): Promise<{ topicIds: bigint[]; slugNotFound: boolean }> {
    const topicIds = toBigIntList(query.topicId);
    if (topicIds.length) {
      return { topicIds, slugNotFound: false };
    }
    if (!query.topicSlug) {
      return { topicIds: [], slugNotFound: false };
    }
    const normalizedSlug = this.normalizeFilterSlug(query.topicSlug);
    if (!normalizedSlug) {
      return { topicIds: [], slugNotFound: true };
    }
    const topic = await this.prisma.topic.findUnique({
      where: { slug: normalizedSlug },
      select: { id: true },
    });
    if (!topic) {
      return { topicIds: [], slugNotFound: true };
    }
    return { topicIds: [topic.id], slugNotFound: false };
  }

  private async resolveTagFilter(
    query: TagFilterInput,
  ): Promise<{ tagIds: bigint[]; slugNotFound: boolean }> {
    const tagIds = toBigIntList(query.tagId);
    if (tagIds.length) {
      return { tagIds, slugNotFound: false };
    }
    if (!query.tagSlug) {
      return { tagIds: [], slugNotFound: false };
    }
    const normalizedSlug = this.normalizeFilterSlug(query.tagSlug);
    if (!normalizedSlug) {
      return { tagIds: [], slugNotFound: true };
    }
    const tag = await this.prisma.tag.findUnique({
      where: { slug: normalizedSlug },
      select: { id: true },
    });
    if (!tag) {
      return { tagIds: [], slugNotFound: true };
    }
    return { tagIds: [tag.id], slugNotFound: false };
  }

  private normalizeFilterSlug(raw?: string): string | undefined {
    if (raw === undefined || raw === null) {
      return undefined;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      return undefined;
    }
    const decoded = safeDecodeSlug(trimmed);
    const normalized = normalizeFaText(decoded);
    return normalized.length ? normalized : undefined;
  }

  private normalizeShortCode(raw: string): string {
    const trimmed = raw?.trim();
    if (!trimmed) {
      throw new BadRequestException('Short code is required');
    }
    if (trimmed.startsWith(SHORT_LINK_PREFIX)) {
      return trimmed;
    }
    return `${SHORT_LINK_PREFIX}${trimmed}`;
  }

  private buildTopicLinks(
    topics: CreateProductDto['topics'] | UpdateProductDto['topics'],
  ): Array<{ topicId: bigint; order: number }> {
    if (!topics) return [];
    const seen = new Set<string>();
    const out: Array<{ topicId: bigint; order: number }> = [];
    topics.forEach((topic, index) => {
      if (!topic.topicId) return;
      if (seen.has(topic.topicId)) return;
      seen.add(topic.topicId);
      out.push({
        topicId: BigInt(topic.topicId),
        order:
          topic.order !== undefined && topic.order !== null
            ? topic.order
            : index,
      });
    });
    return out;
  }

  private async ensureUniqueSlug(
    source: string,
    ignoreId?: bigint,
  ): Promise<string> {
    const base = makeFaSlug(source);
    if (!base) {
      throw new BadRequestException('Slug cannot be resolved from title.');
    }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate =
        attempt === 0 ? base : clampFaSlug(`${base}-${attempt + 1}`);
      const existing = await this.prisma.product.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing || (ignoreId && existing.id === ignoreId)) {
        return candidate;
      }
    }
    return clampFaSlug(`${base}-${Date.now()}`);
  }

  private async createSlugRedirect(
    trx: PrismaTxClient,
    entityId: bigint,
    fromSlug: string,
    toSlug: string,
  ): Promise<void> {
    if (fromSlug === toSlug) {
      return;
    }
    try {
      await trx.slugRedirect.create({
        data: {
          entityType: PRODUCT_ENTITY_TYPE,
          entityId: entityId.toString(),
          fromSlug,
          toSlug,
        },
      });
    } catch (error: unknown) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
        throw error;
      }
      if (error.code === 'P2002') {
        throw new BadRequestException(
          `A redirect already exists for slug "${fromSlug}"`,
        );
      }
      throw error;
    }
  }

  private toDecimal(value?: number | null): Prisma.Decimal | null {
    if (value === undefined || value === null) return null;
    return new Prisma.Decimal(value);
  }
}
