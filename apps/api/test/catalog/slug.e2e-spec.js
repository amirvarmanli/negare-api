"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const testing_1 = require("@nestjs/testing");
const request = __importStar(require("supertest"));
const categories_controller_1 = require("@app/catalog/categories/categories.controller");
const categories_service_1 = require("@app/catalog/categories/categories.service");
const topics_controller_1 = require("@app/catalog/topics/topics.controller");
const topics_service_1 = require("@app/catalog/topics/topics.service");
const products_controller_1 = require("@app/catalog/product/products.controller");
const product_service_1 = require("@app/catalog/product/product.service");
describe('Catalog slug endpoints (e2e)', () => {
    let app;
    let categoriesService;
    let topicsService;
    let productService;
    beforeAll(async () => {
        categoriesService = {
            findBySlug: jest.fn(),
            findById: jest.fn(),
        };
        topicsService = {
            findBySlug: jest.fn(),
            findById: jest.fn(),
        };
        productService = {
            findBySlug: jest.fn(),
            findByIdOrSlug: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            findAll: jest.fn(),
            remove: jest.fn(),
            toggleLike: jest.fn(),
            toggleBookmark: jest.fn(),
            registerDownload: jest.fn(),
            incrementView: jest.fn(),
        };
        const moduleRef = await testing_1.Test.createTestingModule({
            controllers: [categories_controller_1.CategoriesController, topics_controller_1.TopicsController, products_controller_1.ProductController],
            providers: [
                { provide: categories_service_1.CategoriesService, useValue: categoriesService },
                { provide: topics_service_1.TopicsService, useValue: topicsService },
                { provide: product_service_1.ProductService, useValue: productService },
            ],
        }).compile();
        app = moduleRef.createNestApplication();
        app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
        await app.init();
    });
    afterAll(async () => {
        await app.close();
    });
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('serves decoded/normalized category slugs', async () => {
        categoriesService.findBySlug.mockResolvedValue({
            category: {
                id: '1',
                name: 'نقاشی',
                slug: 'نقاشی-و-تصویرسازی',
                parentId: null,
                coverUrl: undefined,
            },
        });
        const encoded = encodeURIComponent('نقاشی-و-تصویرسازی');
        const res = await request(app.getHttpServer())
            .get(`/catalog/categories/${encoded}`)
            .expect(200);
        expect(res.body).toMatchObject({
            id: '1',
            slug: 'نقاشی-و-تصویرسازی',
        });
        expect(categoriesService.findBySlug).toHaveBeenCalledWith('نقاشی-و-تصویرسازی');
    });
    it('issues 301 redirect for stale category slugs', async () => {
        categoriesService.findBySlug.mockResolvedValue({
            redirectTo: 'نقاشی-مدرن',
        });
        const res = await request(app.getHttpServer())
            .get('/catalog/categories/%D9%86%D9%82%D8%A7%D8%B4%DB%8C')
            .expect(301);
        expect(res.headers.location).toBe(`/catalog/categories/${encodeURIComponent('نقاشی-مدرن')}`);
    });
    it('supports Persian topic slugs and redirect chains', async () => {
        topicsService.findBySlug.mockResolvedValue({
            redirectTo: 'تصویرسازی-دیجیتال',
        });
        const res = await request(app.getHttpServer())
            .get('/catalog/topics/%D8%AA%D8%B5%D9%88%DB%8C%D8%B1%D8%B3%D8%A7%D8%B2%DB%8C')
            .expect(301);
        expect(res.headers.location).toBe(`/catalog/topics/${encodeURIComponent('تصویرسازی-دیجیتال')}`);
    });
    it('returns topic payload when slug matches', async () => {
        topicsService.findBySlug.mockResolvedValue({
            topic: {
                id: '42',
                name: 'تایپوگرافی',
                slug: 'تایپوگرافی',
                coverUrl: undefined,
                usageCount: 3,
            },
        });
        const res = await request(app.getHttpServer())
            .get(`/catalog/topics/${encodeURIComponent('تایپوگرافی')}`)
            .expect(200);
        expect(res.body).toMatchObject({
            id: '42',
            slug: 'تایپوگرافی',
        });
        expect(topicsService.findBySlug).toHaveBeenCalledWith('تایپوگرافی');
    });
    it('handles double-encoded product slugs', async () => {
        productService.findBySlug.mockResolvedValue({
            product: {
                id: '99',
                slug: 'محصول-آزمایشی',
                title: 'محصول آزمایشی',
            },
        });
        const doubleEncoded = encodeURIComponent(encodeURIComponent('محصول-آزمایشی'));
        const res = await request(app.getHttpServer())
            .get(`/catalog/products/${doubleEncoded}`)
            .expect(200);
        expect(res.body.slug).toBe('محصول-آزمایشی');
        expect(productService.findBySlug).toHaveBeenCalledWith('محصول-آزمایشی');
    });
    it('redirects product slugs when requested slug is stale', async () => {
        productService.findBySlug.mockResolvedValue({
            redirectTo: 'محصول-جدید',
        });
        const res = await request(app.getHttpServer())
            .get(`/catalog/products/${encodeURIComponent('محصول-قدیمی')}`)
            .expect(301);
        expect(res.headers.location).toBe(`/catalog/products/${encodeURIComponent('محصول-جدید')}`);
    });
});
