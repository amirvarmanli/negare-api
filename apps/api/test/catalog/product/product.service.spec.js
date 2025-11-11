"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const product_service_1 = require("@app/catalog/product/product.service");
const actor = { id: 'user-1', isAdmin: true };
function makeProduct(overrides = {}) {
    const now = new Date();
    return {
        id: BigInt(1),
        slug: 'test-slug',
        title: 'Test Product',
        description: null,
        coverUrl: null,
        shortLink: null,
        graphicFormats: [],
        colors: [],
        pricingType: client_1.PricingType.FREE,
        price: null,
        status: client_1.ProductStatus.DRAFT,
        publishedAt: null,
        fileSizeMB: 0,
        fileBytes: null,
        seoTitle: null,
        seoDescription: null,
        seoKeywords: [],
        viewsCount: 0,
        downloadsCount: 0,
        likesCount: 0,
        createdAt: now,
        updatedAt: now,
        supplierLinks: [],
        categoryLinks: [],
        tagLinks: [],
        topics: [],
        assets: [],
        file: null,
        fileId: null,
        ...overrides,
    };
}
function makeCreateDto() {
    return {
        slug: 'slug-' + Math.random().toString(36).slice(2),
        title: 'Sample title',
        graphicFormats: [client_1.GraphicFormat.SVG],
        pricingType: client_1.PricingType.FREE,
    };
}
function makeUpdateDto() {
    return {};
}
function setup() {
    const baseProduct = makeProduct();
    const productCreate = jest.fn().mockResolvedValue(baseProduct);
    const productFindUnique = jest.fn().mockResolvedValue(null);
    const productFindFirst = jest.fn().mockResolvedValue(baseProduct);
    const productFileFindUnique = jest.fn().mockResolvedValue({ id: BigInt(10) });
    const productUpdate = jest.fn().mockResolvedValue(baseProduct);
    const slugRedirectCreate = jest.fn().mockResolvedValue(undefined);
    const transactionClient = {
        productSupplier: {
            deleteMany: jest.fn().mockResolvedValue(undefined),
            createMany: jest.fn().mockResolvedValue(undefined),
        },
        productCategory: {
            deleteMany: jest.fn().mockResolvedValue(undefined),
            findMany: jest.fn().mockResolvedValue([]),
            createMany: jest.fn().mockResolvedValue(undefined),
        },
        productTag: {
            deleteMany: jest.fn().mockResolvedValue(undefined),
            findMany: jest.fn().mockResolvedValue([]),
            createMany: jest.fn().mockResolvedValue(undefined),
        },
        productTopic: {
            deleteMany: jest.fn().mockResolvedValue(undefined),
            createMany: jest.fn().mockResolvedValue(undefined),
        },
        productAsset: {
            deleteMany: jest.fn().mockResolvedValue(undefined),
            createMany: jest.fn().mockResolvedValue(undefined),
        },
        product: {
            update: productUpdate,
        },
        slugRedirect: {
            create: slugRedirectCreate,
        },
    };
    const prismaMock = {
        product: {
            create: productCreate,
            findUnique: productFindUnique,
            findFirst: productFindFirst,
        },
        productFile: {
            findUnique: productFileFindUnique,
        },
        productSupplier: {
            findFirst: jest.fn().mockResolvedValue({ productId: baseProduct.id }),
        },
        productCategory: {
            deleteMany: jest.fn().mockResolvedValue(undefined),
            findMany: jest.fn().mockResolvedValue([]),
            createMany: jest.fn().mockResolvedValue(undefined),
        },
        productTag: {
            deleteMany: jest.fn().mockResolvedValue(undefined),
            findMany: jest.fn().mockResolvedValue([]),
            createMany: jest.fn().mockResolvedValue(undefined),
        },
        productTopic: {
            deleteMany: jest.fn().mockResolvedValue(undefined),
            createMany: jest.fn().mockResolvedValue(undefined),
        },
        productAsset: {
            deleteMany: jest.fn().mockResolvedValue(undefined),
            createMany: jest.fn().mockResolvedValue(undefined),
        },
        bookmark: {
            findUnique: jest.fn(),
            delete: jest.fn(),
            create: jest.fn(),
        },
        like: {
            findUnique: jest.fn(),
            delete: jest.fn(),
            create: jest.fn(),
        },
        productView: {
            create: jest.fn(),
        },
        productDownload: {
            create: jest.fn(),
        },
        $transaction: jest
            .fn()
            .mockImplementation(async (cb) => cb(transactionClient)),
    };
    const service = new product_service_1.ProductService(prismaMock);
    return {
        service,
        prismaMock,
        transactionClient,
        baseProduct,
        productCreate,
        productUpdate,
        productFileFindUnique,
        productFindUnique,
        slugRedirectCreate,
    };
}
describe('ProductService file relations', () => {
    it('connects existing ProductFile when fileId is provided', async () => {
        const { service, productCreate, productFileFindUnique } = setup();
        const dto = makeCreateDto();
        dto.fileId = '42';
        await service.create(dto, actor);
        expect(productFileFindUnique).toHaveBeenCalledWith({
            where: { id: BigInt(42) },
            select: { id: true },
        });
        const createArgs = productCreate.mock.calls[0][0].data;
        expect(createArgs.file).toEqual({ connect: { id: BigInt(42) } });
    });
    it('throws BadRequest when fileId does not point to an existing ProductFile', async () => {
        const { service, productFileFindUnique, productCreate } = setup();
        productFileFindUnique.mockResolvedValueOnce(null);
        const dto = makeCreateDto();
        dto.fileId = '99';
        await expect(service.create(dto, actor)).rejects.toThrow('Invalid fileId: ProductFile not found');
        expect(productCreate).not.toHaveBeenCalled();
    });
    it('creates nested ProductFile when inline payload is present', async () => {
        const { service, productCreate, productFileFindUnique } = setup();
        const dto = makeCreateDto();
        dto.file = {
            storageKey: 'products/2025/hero.zip',
            originalName: 'hero.zip',
            size: '1024',
            mimeType: 'application/zip',
            meta: { foo: 'bar' },
        };
        await service.create(dto, actor);
        expect(productFileFindUnique).not.toHaveBeenCalled();
        const createArgs = productCreate.mock.calls[0][0].data;
        expect(createArgs.file).toEqual({
            create: {
                storageKey: 'products/2025/hero.zip',
                originalName: 'hero.zip',
                size: BigInt(1024),
                mimeType: 'application/zip',
                meta: { foo: 'bar' },
            },
        });
    });
    it('omits file relation when neither fileId nor file is provided', async () => {
        const { service, productCreate } = setup();
        const dto = makeCreateDto();
        await service.create(dto, actor);
        const createArgs = productCreate.mock.calls[0][0].data;
        expect(createArgs.file).toBeUndefined();
    });
    it('prevents mixing fileId and inline file payload on create', async () => {
        const { service } = setup();
        const dto = makeCreateDto();
        dto.fileId = '5';
        dto.file = {
            storageKey: 'dup/file.zip',
        };
        await expect(service.create(dto, actor)).rejects.toThrow(common_1.BadRequestException);
    });
    it('connects existing ProductFile during update', async () => {
        const { service, productFileFindUnique, transactionClient } = setup();
        const dto = makeUpdateDto();
        dto.fileId = '77';
        await service.update('1', dto, actor);
        expect(productFileFindUnique).toHaveBeenCalledWith({
            where: { id: BigInt(77) },
            select: { id: true },
        });
        const updateArgs = transactionClient.product.update.mock.calls[0][0].data;
        expect(updateArgs.file).toEqual({ connect: { id: BigInt(77) } });
    });
    it('creates nested ProductFile during update when file payload is provided', async () => {
        const { service, transactionClient, productFileFindUnique } = setup();
        const dto = makeUpdateDto();
        dto.file = {
            storageKey: 'products/new.zip',
            size: '2048',
        };
        await service.update('1', dto, actor);
        expect(productFileFindUnique).not.toHaveBeenCalled();
        const updateArgs = transactionClient.product.update.mock.calls[0][0].data;
        expect(updateArgs.file).toEqual({
            create: {
                storageKey: 'products/new.zip',
                originalName: null,
                size: BigInt(2048),
                mimeType: null,
                meta: null,
            },
        });
    });
    it('disconnects ProductFile when fileId is explicitly set to null', async () => {
        const { service, transactionClient } = setup();
        const dto = makeUpdateDto();
        dto.fileId = null;
        await service.update('1', dto, actor);
        const updateArgs = transactionClient.product.update.mock.calls[0][0].data;
        expect(updateArgs.file).toEqual({ disconnect: true });
    });
    it('throws when update references non-existent ProductFile', async () => {
        const { service, productFileFindUnique } = setup();
        productFileFindUnique.mockResolvedValueOnce(null);
        const dto = makeUpdateDto();
        dto.fileId = '88';
        await expect(service.update('1', dto, actor)).rejects.toThrow('Invalid fileId: ProductFile not found');
    });
    it('prevents mixing fileId and inline file payload on update', async () => {
        const { service } = setup();
        const dto = makeUpdateDto();
        dto.fileId = '19';
        dto.file = { storageKey: 'conflict.zip' };
        await expect(service.update('1', dto, actor)).rejects.toThrow(common_1.BadRequestException);
    });
});
describe('ProductService slug handling', () => {
    it('generates slug from title when slug is missing', async () => {
        const { service, productCreate, productFindUnique } = setup();
        const dto = makeCreateDto();
        delete dto.slug;
        dto.title = 'نمونه محصول';
        await service.create(dto, actor);
        expect(productFindUnique).toHaveBeenCalledWith({
            where: { slug: 'نمونه-محصول' },
            select: { id: true },
        });
        const createArgs = productCreate.mock.calls[0][0].data;
        expect(createArgs.slug).toBe('نمونه-محصول');
    });
    it('appends numeric suffix when slug already exists', async () => {
        const { service, productCreate, productFindUnique } = setup();
        const dto = makeCreateDto();
        delete dto.slug;
        productFindUnique
            .mockResolvedValueOnce({ id: BigInt(2) })
            .mockResolvedValueOnce(null);
        await service.create(dto, actor);
        const createArgs = productCreate.mock.calls[0][0].data;
        expect(createArgs.slug.endsWith('-2')).toBe(true);
    });
    it('creates slug redirect when slug changes on update', async () => {
        const { service, transactionClient, baseProduct, productFindUnique } = setup();
        productFindUnique.mockResolvedValue(null);
        const dto = makeUpdateDto();
        dto.slug = 'محصول تازه';
        await service.update(baseProduct.slug, dto, actor);
        expect(transactionClient.slugRedirect.create).toHaveBeenCalledWith({
            data: {
                entityType: 'product',
                entityId: baseProduct.id.toString(),
                fromSlug: baseProduct.slug,
                toSlug: 'محصول-تازه',
            },
        });
    });
});
