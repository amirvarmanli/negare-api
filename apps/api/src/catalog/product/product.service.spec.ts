import { Prisma, PricingType, ProductStatus, GraphicFormat } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { ProductService, toBigIntList, parseGraphicFormatList } from './product.service';
import { productInclude, ProductWithRelations } from './product.mapper';
import { ProductFindQueryDto } from './dtos/product-query.dto';
import { PrismaService } from '@app/prisma/prisma.service';

const now = new Date();
const baseProduct: ProductWithRelations = {
  id: 1n,
  slug: 'product-1',
  title: 'Product 1',
  description: null,
  coverUrl: null,
  shortLink: null,
  graphicFormats: [GraphicFormat.PSD],
  colors: [],
  pricingType: PricingType.FREE,
  price: new Prisma.Decimal(0),
  status: ProductStatus.PUBLISHED,
  viewsCount: 0,
  downloadsCount: 0,
  likesCount: 0,
  seoKeywords: [],
  seoTitle: null,
  seoDescription: null,
  fileSizeMB: 0,
  fileBytes: null,
  createdAt: now,
  updatedAt: now,
  supplierLinks: [],
  assets: [],
  categoryLinks: [],
  tagLinks: [],
  topics: [],
  file: null,
  publishedAt: null,
};

const cloneProduct = (
  overrides?: Partial<ProductWithRelations>,
): ProductWithRelations =>
  ({ ...baseProduct, ...overrides }) as ProductWithRelations;

const createFindAllService = (options?: { topicResult?: { id: bigint } | null }) => {
  const findManyMock = jest.fn().mockResolvedValue([cloneProduct()]);
  const topicFindUniqueMock = jest.fn().mockResolvedValue(options?.topicResult ?? null);
  const likeFindManyMock = jest.fn().mockResolvedValue([]);
  const bookmarkFindManyMock = jest.fn().mockResolvedValue([]);
  const prisma = {
    product: { findMany: findManyMock },
    topic: { findUnique: topicFindUniqueMock },
    like: { findMany: likeFindManyMock },
    bookmark: { findMany: bookmarkFindManyMock },
  } as unknown as PrismaService;
  return { service: new ProductService(prisma), findManyMock, topicFindUniqueMock };
};

const createFindAllWithReactions = (options?: {
  liked?: bigint[];
  bookmarked?: bigint[];
}) => {
  const likedIds = options?.liked ?? [];
  const bookmarkedIds = options?.bookmarked ?? [];
  const findManyMock = jest.fn().mockResolvedValue([cloneProduct()]);
  const likeFindManyMock = jest.fn().mockImplementation(
    ({
      where,
    }: {
      where?: { productId?: { in?: bigint[] } };
    }) => {
      const ids = where?.productId?.in ?? [];
      return ids
        .filter((id) => likedIds.includes(id))
        .map((productId) => ({ productId }));
    },
  );
  const bookmarkFindManyMock = jest.fn().mockImplementation(
    ({
      where,
    }: {
      where?: { productId?: { in?: bigint[] } };
    }) => {
      const ids = where?.productId?.in ?? [];
      return ids
        .filter((id) => bookmarkedIds.includes(id))
        .map((productId) => ({ productId }));
    },
  );
  const prisma = {
    product: { findMany: findManyMock },
    topic: { findUnique: jest.fn().mockResolvedValue(null) },
    like: { findMany: likeFindManyMock },
    bookmark: { findMany: bookmarkFindManyMock },
  } as unknown as PrismaService;

  return {
    service: new ProductService(prisma),
    findManyMock,
    likeFindManyMock,
    bookmarkFindManyMock,
  };
};

const createStatefulReactionService = () => {
  const likedSet = new Set<bigint>();
  const bookmarkedSet = new Set<bigint>();
  let likesCount = 0;

  const buildProduct = () => ({ ...cloneProduct(), likesCount });

  const productFindManyMock = jest.fn().mockImplementation(() => [buildProduct()]);
  const productUpdateMock = jest
    .fn()
    .mockImplementation(({ data }: { data: { likesCount?: { increment?: number; decrement?: number } } }) => {
      if (data.likesCount?.increment) {
        likesCount += data.likesCount.increment;
      }
      if (data.likesCount?.decrement) {
        likesCount = Math.max(0, likesCount - data.likesCount.decrement);
      }
      return Promise.resolve({ likesCount });
    });
  const productFindUniqueMock = jest.fn().mockImplementation(() => Promise.resolve({ likesCount }));

  const likeFindUniqueMock = jest.fn().mockImplementation(
    ({ where }: { where: { userId_productId: { productId: bigint } } }) => {
      const productId = where.userId_productId.productId;
      return likedSet.has(productId) ? { productId } : null;
    },
  );
  const likeFindManyMock = jest.fn().mockImplementation(
    ({
      where,
    }: {
      where?: { productId?: { in?: bigint[] } };
    }) => {
      const ids = where?.productId?.in ?? [];
      return ids
        .filter((id) => likedSet.has(id))
        .map((productId) => ({ productId }));
    },
  );
  const likeCreateMock = jest.fn().mockImplementation(({ data }: { data: { productId: bigint } }) => {
    likedSet.add(data.productId);
    return { productId: data.productId };
  });
  const likeDeleteMock = jest.fn().mockImplementation(
    ({ where }: { where: { userId_productId: { productId: bigint } } }) => {
      const productId = where.userId_productId.productId;
      likedSet.delete(productId);
      return { productId };
    },
  );

  const bookmarkFindUniqueMock = jest.fn().mockImplementation(
    ({ where }: { where: { userId_productId: { productId: bigint } } }) => {
      const productId = where.userId_productId.productId;
      return bookmarkedSet.has(productId) ? { productId } : null;
    },
  );
  const bookmarkFindManyMock = jest.fn().mockImplementation(
    ({
      where,
    }: {
      where?: { productId?: { in?: bigint[] } };
    }) => {
      const ids = where?.productId?.in ?? [];
      return ids
        .filter((id) => bookmarkedSet.has(id))
        .map((productId) => ({ productId }));
    },
  );
  const bookmarkCreateMock = jest.fn().mockImplementation(({ data }: { data: { productId: bigint } }) => {
    bookmarkedSet.add(data.productId);
    return { productId: data.productId };
  });
  const bookmarkDeleteMock = jest.fn().mockImplementation(
    ({ where }: { where: { userId_productId: { productId: bigint } } }) => {
      const productId = where.userId_productId.productId;
      bookmarkedSet.delete(productId);
      return { productId };
    },
  );

  const transactionMock = jest.fn().mockImplementation((operations: Array<Promise<unknown>>) =>
    Promise.all(operations),
  );

  const prisma = {
    topic: { findUnique: jest.fn().mockResolvedValue(null) },
    product: {
      findMany: productFindManyMock,
      findUnique: productFindUniqueMock,
      update: productUpdateMock,
    },
    like: {
      findUnique: likeFindUniqueMock,
      findMany: likeFindManyMock,
      create: likeCreateMock,
      delete: likeDeleteMock,
    },
    bookmark: {
      findUnique: bookmarkFindUniqueMock,
      findMany: bookmarkFindManyMock,
      create: bookmarkCreateMock,
      delete: bookmarkDeleteMock,
    },
    $transaction: transactionMock,
  } as unknown as PrismaService;

  return {
    service: new ProductService(prisma),
    likedSet,
    bookmarkedSet,
  };
};

const createSearchService = (options?: {
  rows?: Array<{ id: bigint; score: number }>;
  total?: number;
  likedIds?: bigint[];
  bookmarkedIds?: bigint[];
  topicResult?: { id: bigint } | null;
}) => {
  const rows = options?.rows ?? [];
  const total = options?.total ?? rows.length;
  const queryRawMock = jest
    .fn()
    .mockResolvedValueOnce(rows)
    .mockResolvedValueOnce([{ count: BigInt(total) }]);
  const productFindManyMock = jest.fn().mockResolvedValue(
    rows.map((row) => ({ ...cloneProduct(), id: row.id })),
  );
  const likeFindManyMock = jest.fn().mockResolvedValue(
    (options?.likedIds ?? []).map((id) => ({ productId: id })),
  );
  const bookmarkFindManyMock = jest.fn().mockResolvedValue(
    (options?.bookmarkedIds ?? []).map((id) => ({ productId: id })),
  );
  const topicFindUniqueMock = jest.fn().mockResolvedValue(
    options?.topicResult ?? null,
  );
  const prisma = {
    $queryRaw: queryRawMock,
    product: { findMany: productFindManyMock },
    topic: { findUnique: topicFindUniqueMock },
    like: { findMany: likeFindManyMock },
    bookmark: { findMany: bookmarkFindManyMock },
  } as unknown as PrismaService;
  return {
    service: new ProductService(prisma),
    queryRawMock,
    productFindManyMock,
    likeFindManyMock,
    bookmarkFindManyMock,
    topicFindUniqueMock,
  };
};

const createShortCodeService = (options?: {
  product?: ProductWithRelations;
  liked?: boolean;
  bookmarked?: boolean;
}) => {
  const product = options?.product ?? cloneProduct({ shortLink: 'p/123456' });
  const findUniqueMock = jest.fn().mockResolvedValue(product);
  const likeFindManyMock = jest.fn().mockImplementation(
    ({ where }: { where?: { productId?: { in?: bigint[] } } }) => {
      const ids = where?.productId?.in ?? [];
      if (options?.liked && ids.includes(product.id)) {
        return [{ productId: product.id }];
      }
      return [];
    },
  );
  const bookmarkFindManyMock = jest.fn().mockImplementation(
    ({ where }: { where?: { productId?: { in?: bigint[] } } }) => {
      const ids = where?.productId?.in ?? [];
      if (options?.bookmarked && ids.includes(product.id)) {
        return [{ productId: product.id }];
      }
      return [];
    },
  );
  const prisma = {
    product: { findUnique: findUniqueMock },
    like: { findMany: likeFindManyMock },
    bookmark: { findMany: bookmarkFindManyMock },
  } as unknown as PrismaService;
  return { service: new ProductService(prisma), findUniqueMock, product };
};

describe('ProductService helpers', () => {
  describe('toBigIntList', () => {
    it('parses comma-separated ids and deduplicates', () => {
      expect(toBigIntList('1,2,3')).toEqual([1n, 2n, 3n]);
      expect(toBigIntList(' 1 , 2 , 2 , x ')).toEqual([1n, 2n]);
    });

    it('returns empty array for empty input', () => {
      expect(toBigIntList()).toEqual([]);
      expect(toBigIntList('')).toEqual([]);
    });
  });

  describe('parseGraphicFormatList', () => {
    it('parses valid enum values case-insensitively and deduplicates', () => {
      const result = parseGraphicFormatList('PSD,AI,psd');
      expect(result).toEqual(
        expect.arrayContaining([GraphicFormat.PSD, GraphicFormat.AI]),
      );
      expect(result).toHaveLength(2);
    });

    it('ignores invalid entries', () => {
      const result = parseGraphicFormatList('psd,INVALID, PNG ');
      expect(result).toEqual(
        expect.arrayContaining([GraphicFormat.PSD, GraphicFormat.PNG]),
      );
      expect(result).toHaveLength(2);
    });

    it('returns empty array for empty input', () => {
      expect(parseGraphicFormatList()).toEqual([]);
      expect(parseGraphicFormatList('')).toEqual([]);
    });
  });
});

describe('ProductService.findAll filters', () => {
  it('applies multi-value category filter', async () => {
    const { service, findManyMock } = createFindAllService();
    const query: ProductFindQueryDto = { categoryId: '1,2' };

    await service.findAll(query);

    const args = findManyMock.mock.calls[0][0];
    expect(args.include).toBe(productInclude);
    expect(args.where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          categoryLinks: { some: { categoryId: { in: [1n, 2n] } } },
        }),
      ]),
    );
  });

  it('combines tagId and topicId filters', async () => {
    const { service, findManyMock } = createFindAllService();
    const query: ProductFindQueryDto = {
      tagId: '5,9',
      topicId: '3',
      status: ProductStatus.PUBLISHED,
    };

    await service.findAll(query);

    const ands = findManyMock.mock.calls[0][0].where.AND;
    expect(ands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tagLinks: { some: { tagId: { in: [5n, 9n] } } },
        }),
        expect.objectContaining({
          topics: { some: { topicId: { in: [3n] } } },
        }),
      ]),
    );
  });

  it('applies multi-value graphicFormat filter', async () => {
    const { service, findManyMock } = createFindAllService();
    const query: ProductFindQueryDto = { graphicFormat: 'PSD,AI' };

    await service.findAll(query);

    const ands = findManyMock.mock.calls[0][0].where.AND;
    expect(ands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          graphicFormats: { hasSome: [GraphicFormat.PSD, GraphicFormat.AI] },
        }),
      ]),
    );
  });

  it('applies hasFile and hasAssets flags', async () => {
    const { service, findManyMock } = createFindAllService();
    const query: ProductFindQueryDto = { hasFile: 'true', hasAssets: 'true' };

    await service.findAll(query);

    const ands = findManyMock.mock.calls[0][0].where.AND;
    expect(ands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: { isNot: null } }),
        expect.objectContaining({ assets: { some: {} } }),
      ]),
    );
  });

  it('filters by topicSlug when topicId is absent', async () => {
    const topicId = 42n;
    const { service, findManyMock, topicFindUniqueMock } = createFindAllService({
      topicResult: { id: topicId },
    });
    const query: ProductFindQueryDto = { topicSlug: 'poster-design' };

    await service.findAll(query);

    expect(topicFindUniqueMock).toHaveBeenCalledWith({
      where: { slug: 'poster-design' },
      select: { id: true },
    });
    const ands = findManyMock.mock.calls[0][0].where.AND;
    expect(ands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          topics: { some: { topicId: { in: [topicId] } } },
        }),
      ]),
    );
  });

  it('filters by topicId when provided', async () => {
    const { service, findManyMock } = createFindAllService();

    await service.findAll({ topicId: '8' });

    const ands = findManyMock.mock.calls[0][0].where.AND;
    expect(ands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          topics: { some: { topicId: { in: [8n] } } },
        }),
      ]),
    );
  });

  it('returns empty list when topicSlug cannot be resolved', async () => {
    const { service, findManyMock, topicFindUniqueMock } = createFindAllService();
    const query: ProductFindQueryDto = { topicSlug: 'missing-topic' };

    const result = await service.findAll(query);

    expect(topicFindUniqueMock).toHaveBeenCalledTimes(1);
    expect(findManyMock).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
  });

  it('searches tag names when q is provided', async () => {
    const { service, findManyMock } = createFindAllService();
    const query: ProductFindQueryDto = { q: 'design' };

    await service.findAll(query);

    const ands = findManyMock.mock.calls[0][0].where.AND;
    const textClause = ands.find((clause) => clause.OR) as { OR?: unknown[] } | undefined;
    const tagCondition = textClause?.OR?.find(
      (condition) =>
        typeof condition === 'object' &&
        condition !== null &&
        'tagLinks' in condition,
    ) as
      | {
          tagLinks?: {
            some?: {
              tag?: { OR?: Array<Record<string, unknown>> };
            };
          };
        }
      | undefined;

    expect(tagCondition?.tagLinks?.some?.tag?.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: { contains: 'design', mode: 'insensitive' },
        }),
      ]),
    );
  });

  it('searches tag slugs when q is provided', async () => {
    const { service, findManyMock } = createFindAllService();
    await service.findAll({ q: 'branding' });

    const ands = findManyMock.mock.calls[0][0].where.AND;
    const textClause = ands.find((clause) => clause.OR) as { OR?: unknown[] } | undefined;
    const tagCondition = textClause?.OR?.find(
      (condition) =>
        typeof condition === 'object' &&
        condition !== null &&
        'tagLinks' in condition,
    ) as
      | {
          tagLinks?: {
            some?: {
              tag?: { OR?: Array<Record<string, unknown>> };
            };
          };
        }
      | undefined;

    expect(tagCondition?.tagLinks?.some?.tag?.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: { contains: 'branding', mode: 'insensitive' },
        }),
      ]),
    );
  });

  it('filters by tagId when provided', async () => {
    const { service, findManyMock } = createFindAllService();

    await service.findAll({ tagId: '4,5,4' });

    const ands = findManyMock.mock.calls[0][0].where.AND;
    expect(ands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tagLinks: { some: { tagId: { in: [4n, 5n] } } },
        }),
      ]),
    );
  });

  it('searches titles when q is provided', async () => {
    const { service, findManyMock } = createFindAllService();
    await service.findAll({ q: 'logo' });

    const ands = findManyMock.mock.calls[0][0].where.AND;
    const textClause = ands.find((clause) => clause.OR) as { OR?: unknown[] } | undefined;

    expect(textClause?.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: { contains: 'logo', mode: 'insensitive' },
        }),
      ]),
    );
  });

  it('combines q with other filters', async () => {
    const { service, findManyMock } = createFindAllService();
    await service.findAll({ q: 'icon', categoryId: '7' });

    const ands = findManyMock.mock.calls[0][0].where.AND;
    expect(ands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          categoryLinks: { some: { categoryId: { in: [7n] } } },
        }),
      ]),
    );
    const textClause = ands.find((clause) => clause.OR) as { OR?: unknown[] } | undefined;
    expect(textClause?.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: { contains: 'icon', mode: 'insensitive' },
        }),
      ]),
    );
  });

  it('applies tagId filter alongside q', async () => {
    const { service, findManyMock } = createFindAllService();
    await service.findAll({ q: 'icon', tagId: '3' });

    const ands = findManyMock.mock.calls[0][0].where.AND;
    expect(ands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tagLinks: { some: { tagId: { in: [3n] } } },
        }),
      ]),
    );
    const textClause = ands.find((clause) => clause.OR) as { OR?: unknown[] } | undefined;
    expect(textClause?.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: { contains: 'icon', mode: 'insensitive' },
        }),
      ]),
    );
  });

  it('returns empty list when q matches nothing', async () => {
    const { service, findManyMock } = createFindAllService();
    findManyMock.mockResolvedValue([]);

    const result = await service.findAll({ q: 'missing' });

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
  });
});

describe('ProductService reactions', () => {
  it('maps liked and bookmarked flags for the viewer', async () => {
    const { service } = createFindAllWithReactions({
      liked: [baseProduct.id],
      bookmarked: [baseProduct.id],
    });

    const result = await service.findAll({}, 'viewer-id');

    expect(result.items[0].isLikedByCurrentUser).toBe(true);
    expect(result.items[0].isBookmarkedByCurrentUser).toBe(true);
  });

  it('returns false flags when viewer is anonymous', async () => {
    const { service } = createFindAllWithReactions();

    const result = await service.findAll({}, undefined);

    expect(result.items[0].isLikedByCurrentUser).toBe(false);
    expect(result.items[0].isBookmarkedByCurrentUser).toBe(false);
  });

  it('listLikedByUser returns liked products with bookmark status', async () => {
    const product = cloneProduct();
    const likeFindManyMock = jest.fn().mockResolvedValue([
      { productId: product.id, product },
    ]);
    const likeCountMock = jest.fn().mockResolvedValue(1);
    const bookmarkFindManyMock = jest.fn().mockResolvedValue([
      { productId: product.id },
    ]);
    const prisma = {
      like: {
        findMany: likeFindManyMock,
        count: likeCountMock,
      },
      bookmark: {
        findMany: bookmarkFindManyMock,
      },
      topic: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation((ops: Array<Promise<unknown>>) =>
        Promise.all(ops),
      ),
    } as unknown as PrismaService;
    const service = new ProductService(prisma);

    const result = await service.listLikedByUser('user-id', { page: 1, limit: 10 });

    expect(result.items[0].isLikedByCurrentUser).toBe(true);
    expect(result.items[0].isBookmarkedByCurrentUser).toBe(true);
    expect(result.total).toBe(1);
  });

  it('listBookmarkedByUser returns bookmarked products with liked status', async () => {
    const product = cloneProduct();
    const bookmarkFindManyMock = jest.fn().mockResolvedValue([
      { productId: product.id, product },
    ]);
    const bookmarkCountMock = jest.fn().mockResolvedValue(1);
    const likeFindManyMock = jest.fn().mockResolvedValue([
      { productId: product.id },
    ]);
    const prisma = {
      bookmark: {
        findMany: bookmarkFindManyMock,
        count: bookmarkCountMock,
      },
      like: {
        findMany: likeFindManyMock,
      },
      topic: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation((ops: Array<Promise<unknown>>) =>
        Promise.all(ops),
      ),
    } as unknown as PrismaService;
    const service = new ProductService(prisma);

    const result = await service.listBookmarkedByUser('user-id', { page: 1, limit: 10 });

    expect(result.items[0].isBookmarkedByCurrentUser).toBe(true);
    expect(result.items[0].isLikedByCurrentUser).toBe(true);
    expect(result.total).toBe(1);
  });

  it('toggleLike flips the like flag for subsequent fetches', async () => {
    const { service } = createStatefulReactionService();
    const initial = await service.findAll({}, 'viewer');
    expect(initial.items[0].isLikedByCurrentUser).toBe(false);

    await service.toggleLike(String(baseProduct.id), 'viewer');
    const afterLike = await service.findAll({}, 'viewer');
    expect(afterLike.items[0].isLikedByCurrentUser).toBe(true);

    await service.toggleLike(String(baseProduct.id), 'viewer');
    const afterUnlike = await service.findAll({}, 'viewer');
    expect(afterUnlike.items[0].isLikedByCurrentUser).toBe(false);
  });

  it('toggleBookmark flips the bookmark flag for subsequent fetches', async () => {
    const { service } = createStatefulReactionService();
    const initial = await service.findAll({}, 'viewer');
    expect(initial.items[0].isBookmarkedByCurrentUser).toBe(false);

    await service.toggleBookmark(String(baseProduct.id), 'viewer');
    const afterBookmark = await service.findAll({}, 'viewer');
    expect(afterBookmark.items[0].isBookmarkedByCurrentUser).toBe(true);

    await service.toggleBookmark(String(baseProduct.id), 'viewer');
    const afterRemove = await service.findAll({}, 'viewer');
    expect(afterRemove.items[0].isBookmarkedByCurrentUser).toBe(false);
  });

  it('includes reaction flags in detail responses', async () => {
    const product = cloneProduct();
    const findFirstMock = jest.fn().mockResolvedValue(product);
    const likeFindManyMock = jest.fn().mockResolvedValue([{ productId: product.id }]);
    const bookmarkFindManyMock = jest.fn().mockResolvedValue([]);
    const prisma = {
      product: { findFirst: findFirstMock as unknown },
      topic: { findUnique: jest.fn().mockResolvedValue(null) },
      like: { findMany: likeFindManyMock },
      bookmark: { findMany: bookmarkFindManyMock },
    } as unknown as PrismaService;
    const service = new ProductService(prisma);

    const result = await service.findByIdOrSlug('1', 'viewer-id');

    expect(result.isLikedByCurrentUser).toBe(true);
    expect(result.isBookmarkedByCurrentUser).toBe(false);
  });
});

describe('ProductService.search', () => {
  it('returns a product when q matches tags even if title does not', async () => {
    const { service, queryRawMock } = createSearchService({
      rows: [{ id: baseProduct.id, score: 5 }],
    });

    const result = await service.search({ q: 'design' }, 'viewer');
    const firstSql = queryRawMock.mock.calls[0][0] as Prisma.Sql;

    expect(firstSql.sql).toContain('"catalog"."product_tags"');
    expect(firstSql.sql).toContain('"catalog"."tags"');
    expect(result.items[0].title).toBe('Product 1');
    expect(result.items[0].isLikedByCurrentUser).toBe(false);
    expect(result.items[0].isBookmarkedByCurrentUser).toBe(false);
  });

  it('returns empty results when topicSlug cannot be resolved', async () => {
    const { service, queryRawMock, topicFindUniqueMock } = createSearchService({
      rows: [{ id: baseProduct.id, score: 1 }],
    });

    const result = await service.search(
      { q: 'art', topicSlug: 'missing-topic' },
      undefined,
    );

    expect(topicFindUniqueMock).toHaveBeenCalledWith({
      where: { slug: 'missing-topic' },
      select: { id: true },
    });
    expect(queryRawMock).not.toHaveBeenCalled();
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('adds topicId filters to the search SQL', async () => {
    const { service, queryRawMock } = createSearchService({
      rows: [{ id: baseProduct.id, score: 1 }],
    });

    await service.search({ q: 'poster', topicId: '9' }, undefined);

    const firstSql = queryRawMock.mock.calls[0][0] as Prisma.Sql;
    expect(firstSql.sql).toContain('"product_topics" ptop');
    expect(firstSql.sql).toContain('ptop."topic_id" IN (');
  });

  it('applies tagId filters in the search SQL', async () => {
    const { service, queryRawMock } = createSearchService({
      rows: [{ id: baseProduct.id, score: 2 }],
    });

    await service.search({ q: 'poster', tagId: '5' }, undefined);

    const firstSql = queryRawMock.mock.calls[0][0] as Prisma.Sql;
    expect(firstSql.sql).toContain('"product_tags" pt');
    expect(firstSql.sql).toContain('pt."tag_id" IN (');
  });

  it('combines q and tagId filters in the search SQL', async () => {
    const { service, queryRawMock } = createSearchService({
      rows: [{ id: baseProduct.id, score: 3 }],
    });

    await service.search({ q: 'icon', tagId: '3' }, undefined);

    const firstSql = queryRawMock.mock.calls[0][0] as Prisma.Sql;
    expect(firstSql.sql).toContain('pt."tag_id" IN (');
    expect(firstSql.sql).toContain('st.name ILIKE');
  });

  it('maps reaction flags for search results', async () => {
    const { service } = createSearchService({
      rows: [{ id: baseProduct.id, score: 4 }],
      likedIds: [baseProduct.id],
      bookmarkedIds: [baseProduct.id],
    });

    const result = await service.search({ q: 'icon' }, 'viewer-id');

    expect(result.items[0].isLikedByCurrentUser).toBe(true);
    expect(result.items[0].isBookmarkedByCurrentUser).toBe(true);
  });

  it('returns no items when q does not match anything', async () => {
    const { service } = createSearchService({ rows: [], total: 0 });

    const result = await service.search({ q: 'missing' }, undefined);

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('applies additional filters alongside q', async () => {
    const { service, queryRawMock } = createSearchService({ rows: [], total: 0 });

    await service.search({ q: 'poster', categoryId: '5' }, undefined);

    const firstSql = queryRawMock.mock.calls[0][0] as Prisma.Sql;
    expect(firstSql.sql).toContain('"product_categories"');
  });
});

describe('ProductService.findByShortCode', () => {
  it('resolves numeric short code to a product', async () => {
    const { service, findUniqueMock } = createShortCodeService({
      product: cloneProduct({ shortLink: 'p/654321' }),
    });

    const result = await service.findByShortCode('654321');

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { shortLink: 'p/654321' },
      include: productInclude,
    });
    expect(result.shortLink).toBe('p/654321');
  });

  it('accepts already prefixed short codes', async () => {
    const { service, findUniqueMock } = createShortCodeService({
      product: cloneProduct({ shortLink: 'p/654999' }),
    });

    await service.findByShortCode('p/654999');

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { shortLink: 'p/654999' },
      include: productInclude,
    });
  });

  it('sets reaction flags when viewer is present', async () => {
    const { service } = createShortCodeService({
      liked: true,
      bookmarked: true,
    });

    const result = await service.findByShortCode('123456', 'viewer');

    expect(result.isLikedByCurrentUser).toBe(true);
    expect(result.isBookmarkedByCurrentUser).toBe(true);
  });

  it('throws NotFoundException when short code cannot be resolved', async () => {
    const { service, findUniqueMock } = createShortCodeService();
    findUniqueMock.mockResolvedValue(null);

    await expect(service.findByShortCode('999999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
