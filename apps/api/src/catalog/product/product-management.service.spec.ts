import { ProductStatus } from '@prisma/client';
import { PrismaService } from '@app/prisma/prisma.service';
import { ProductService } from '@app/catalog/product/product.service';
import { ProductManagementService } from './product-management.service';

describe('ProductManagementService (supplier list)', () => {
  let prismaMock: {
    product: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };
  let service: ProductManagementService;

  beforeEach(() => {
    prismaMock = {
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    service = new ProductManagementService(
      prismaMock as unknown as PrismaService,
      {} as ProductService,
    );
  });

  it('includes drafts and published items by default for suppliers', async () => {
    await service.list({ type: 'owner', ownerId: 'supplier-1' }, { page: 1 });
    const call = prismaMock.product.findMany.mock.calls[0][0];
    expect(call.where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: {
            in: expect.arrayContaining([
              ProductStatus.PUBLISHED,
              ProductStatus.DRAFT,
            ]),
          },
        }),
      ]),
    );
  });

  it('respects explicit status filters even for owner scope', async () => {
    await service.list(
      { type: 'owner', ownerId: 'supplier-1' },
      { page: 1, status: ProductStatus.ARCHIVED },
    );
    const call = prismaMock.product.findMany.mock.calls[0][0];
    expect(call.where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: ProductStatus.ARCHIVED,
        }),
      ]),
    );
  });
});
