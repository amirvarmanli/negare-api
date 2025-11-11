import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { CategoriesController } from '@app/catalog/categories/categories.controller';
import { CategoriesService } from '@app/catalog/categories/categories.service';
import { TopicsController } from '@app/catalog/topics/topics.controller';
import { TopicsService } from '@app/catalog/topics/topics.service';
import { ProductController } from '@app/catalog/product/products.controller';
import { ProductService } from '@app/catalog/product/product.service';

describe('Catalog slug endpoints (e2e)', () => {
  let app: INestApplication;
  let categoriesService: {
    findBySlug: jest.Mock;
    findById: jest.Mock;
  };
  let topicsService: {
    findBySlug: jest.Mock;
    findById: jest.Mock;
  };
  let productService: {
    findBySlug: jest.Mock;
    findByIdOrSlug: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findAll: jest.Mock;
    remove: jest.Mock;
    toggleLike: jest.Mock;
    toggleBookmark: jest.Mock;
    registerDownload: jest.Mock;
    incrementView: jest.Mock;
  };

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

    const moduleRef = await Test.createTestingModule({
      controllers: [CategoriesController, TopicsController, ProductController],
      providers: [
        { provide: CategoriesService, useValue: categoriesService },
        { provide: TopicsService, useValue: topicsService },
        { provide: ProductService, useValue: productService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
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
    expect(categoriesService.findBySlug).toHaveBeenCalledWith(
      'نقاشی-و-تصویرسازی',
    );
  });

  it('issues 301 redirect for stale category slugs', async () => {
    categoriesService.findBySlug.mockResolvedValue({
      redirectTo: 'نقاشی-مدرن',
    });

    const res = await request(app.getHttpServer())
      .get('/catalog/categories/%D9%86%D9%82%D8%A7%D8%B4%DB%8C')
      .expect(301);

    expect(res.headers.location).toBe(
      `/catalog/categories/${encodeURIComponent('نقاشی-مدرن')}`,
    );
  });

  it('supports Persian topic slugs and redirect chains', async () => {
    topicsService.findBySlug.mockResolvedValue({
      redirectTo: 'تصویرسازی-دیجیتال',
    });

    const res = await request(app.getHttpServer())
      .get('/catalog/topics/%D8%AA%D8%B5%D9%88%DB%8C%D8%B1%D8%B3%D8%A7%D8%B2%DB%8C')
      .expect(301);

    expect(res.headers.location).toBe(
      `/catalog/topics/${encodeURIComponent('تصویرسازی-دیجیتال')}`,
    );
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
    const doubleEncoded = encodeURIComponent(
      encodeURIComponent('محصول-آزمایشی'),
    );

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

    expect(res.headers.location).toBe(
      `/catalog/products/${encodeURIComponent('محصول-جدید')}`,
    );
  });
});
