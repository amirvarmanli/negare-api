import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PricingType,
  ProductStatus,
  GraphicFormat,
} from '@prisma/client';
import { PrismaClientKnownRequestError, Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '@app/prisma/prisma.service';
import { Buffer } from 'buffer';

import { CreateProductDto } from '@app/catalog/product/dtos/product-create.dto';
import { UpdateProductDto } from '@app/catalog/product/dtos/product-update.dto';
import { ProductFindQueryDto, ProductSort } from '@app/catalog/product/dtos/product-query.dto';
import {
  ProductBriefDto,
  ProductDetailDto,
  ProductListResultDto,
} from '@app/catalog/product/dtos/product-response.dto';
import { ProductFileInputDto } from '@app/catalog/product/dtos/product-shared.dto';

import {
  ProductMapper,
  productInclude,
  type ProductWithRelations,
} from '@app/catalog/product/product.mapper';
import {
  clampFaSlug,
  makeFaSlug,
  normalizeFaText,
} from '@shared-slug/slug/fa-slug.util';

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
    ],
  };
}

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

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

    const createdId = await this.prisma.$transaction(async (trx) => {
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

    await this.prisma.$transaction(async (trx) => {
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
        const existingIds = new Set(existing.map((x) => x.categoryId));
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
        const existingIds = new Set(existing.map((x) => x.tagId));
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
    _viewerId?: string,
  ): Promise<ProductDetailDto> {
    const prod = await this.prisma.product.findFirst({
      where: this.withActiveStatus(this.idOrSlugWhere(idOrSlug)),
      include: productInclude,
    });
    if (!prod) throw new NotFoundException('Product not found');
    return ProductMapper.toDetail(prod as ProductWithRelations);
  }

  async findBySlug(
    slug: string,
    viewerId?: string,
  ): Promise<{ product?: ProductDetailDto; redirectTo?: string }> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: productInclude,
    });
    if (product && this.isActiveStatus(product.status)) {
      return {
        product: ProductMapper.toDetail(product as ProductWithRelations),
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

  async findAll(query: ProductFindQueryDto): Promise<ProductListResultDto> {
    const limit = Math.min(Math.max(query.limit ?? 24, 1), 60);
    const sort: ProductSort = (query.sort ?? 'latest') as ProductSort;

    const ands: Prisma.ProductWhereInput[] = [];
    const text = makeTextWhere(query.q);
    if (text) ands.push(text);

    if (query.pricingType)
      ands.push({ pricingType: query.pricingType as PricingType });
    if (query.graphicFormat) {
      ands.push({
        graphicFormats: {
          has: query.graphicFormat as GraphicFormat,
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
      const cid = toBigIntNullable(query.categoryId);
      if (cid) ands.push({ categoryLinks: { some: { categoryId: cid } } });
    }
    if (query.tagId) {
      const tid = toBigIntNullable(query.tagId);
      if (tid) ands.push({ tagLinks: { some: { tagId: tid } } });
    }
    if (query.topicId) {
      const topicId = toBigIntNullable(query.topicId);
      if (topicId) ands.push({ topics: { some: { topicId } } });
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

    const items: ProductBriefDto[] = (rows as ProductWithRelations[]).map(
      ProductMapper.toBrief,
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
  ): Promise<{ liked: boolean }> {
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
      return { liked: false };
    }

    await this.prisma.$transaction([
      this.prisma.like.create({ data: { userId, productId } }),
      this.prisma.product.update({
        where: { id: productId },
        data: { likesCount: { increment: 1 } },
      }),
    ]);
    return { liked: true };
  }

  async toggleBookmark(
    productIdStr: string,
    userId: string,
  ): Promise<{ bookmarked: boolean }> {
    const productId = toBigIntNullable(productIdStr);
    if (productId === null) throw new BadRequestException('Invalid product id');

    const existed = await this.prisma.bookmark.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existed) {
      await this.prisma.bookmark.delete({
        where: { userId_productId: { userId, productId } },
      });
      return { bookmarked: false };
    }

    await this.prisma.bookmark.create({ data: { userId, productId } });
    return { bookmarked: true };
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
    return { slug: normalizeFaText(idOrSlug) };
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
    trx: Prisma.TransactionClient,
    productId: bigint,
    instruction: FileInstruction,
  ): Promise<void> {
    switch (instruction.kind) {
      case 'none':
        return;
      case 'disconnect':
        try {
          await trx.productFile.delete({ where: { productId } });
        } catch (error) {
          if (
            error instanceof PrismaClientKnownRequestError &&
            error.code === 'P2025'
          ) {
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
    trx: Prisma.TransactionClient,
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
    trx: Prisma.TransactionClient,
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
    trx: Prisma.TransactionClient,
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
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          `A redirect already exists for slug "${fromSlug}"`,
        );
      }
      throw error;
    }
  }

  private toDecimal(value?: number | null): Decimal | null {
    if (value === undefined || value === null) return null;
    return new Decimal(value);
  }
}
