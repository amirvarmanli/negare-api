import { DataSource } from 'typeorm';
import { ProductsService } from '../../../catalog/products/products.service';
import { Product, PricingType } from '../../../catalog/entities/content/product.entity';
import { CountersService } from '../../../catalog/counters/counters.service';

describe('ProductsService.decorateProductWithUserState', () => {
  const likesService = {
    isProductLiked: jest.fn(),
  };
  const bookmarksService = {
    isBookmarked: jest.fn(),
  };

  const service = new ProductsService(
    {} as DataSource,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { incrementViews: jest.fn() } as unknown as CountersService,
    likesService as any,
    bookmarksService as any,
    {
      saveUploadedFile: jest.fn(),
      getDownloadStream: jest.fn(),
      getDownloadUrl: jest.fn(),
      deleteFile: jest.fn(),
    } as any,
  );

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns false flags for anonymous users', async () => {
    const product = new Product();
    product.id = '10';

    const result = await service.decorateProductWithUserState(product, undefined);

    expect(result.liked).toBe(false);
    expect(result.bookmarked).toBe(false);
    expect(likesService.isProductLiked).not.toHaveBeenCalled();
    expect(bookmarksService.isBookmarked).not.toHaveBeenCalled();
  });

  it('resolves liked and bookmarked flags for authenticated users', async () => {
    const product = new Product();
    product.id = '42';

    likesService.isProductLiked.mockResolvedValueOnce(true);
    bookmarksService.isBookmarked.mockResolvedValueOnce(false);

    const result = await service.decorateProductWithUserState(product, {
      id: 'user-1',
      roles: ['USER'],
    });

    expect(result.liked).toBe(true);
    expect(result.bookmarked).toBe(false);
    expect(likesService.isProductLiked).toHaveBeenCalledWith('user-1', '42');
    expect(bookmarksService.isBookmarked).toHaveBeenCalledWith('user-1', '42');
  });

  it('requires price for paid products', () => {
    expect(() =>
      (service as any).validatePricing(PricingType.PAID, undefined),
    ).toThrow('Price is required for paid pricing types');
  });

  it('forbids price for free products', () => {
    expect(() =>
      (service as any).validatePricing(PricingType.FREE, '12.00'),
    ).toThrow('Price must be omitted for free products');
  });
});
