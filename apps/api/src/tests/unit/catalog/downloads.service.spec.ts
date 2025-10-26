import { ForbiddenException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { createTestDataSource } from '../../utils/test-database.util';
import { Product, PricingType } from '../../../catalog/entities/content/product.entity';
import { Category } from '../../../catalog/entities/content/category.entity';
import { Tag } from '../../../catalog/entities/content/tag.entity';
import { ProductAsset } from '../../../catalog/entities/content/product-asset.entity';
import { ProductFile } from '../../../catalog/entities/content/product-file.entity';
import { Like } from '../../../catalog/entities/content/like.entity';
import { Bookmark } from '../../../catalog/entities/content/bookmark.entity';
import { ProductDownload } from '../../../catalog/entities/analytics/product-download.entity';
import { User } from '../../../core/users/user.entity';
import { UserRole } from '@app/core/roles/entities/role.entity';
import { Role } from '@app/core/roles/entities/role.entity';
import { Wallet } from '../../../core/wallets/wallet.entity';
import { WalletTransaction } from '../../../core/wallet-transactions/wallet-transaction.entity';
import { DownloadsService } from '../../../catalog/downloads/downloads.service';
import { CountersService } from '../../../catalog/counters/counters.service';
import { StorageService } from '../../../catalog/storage/storage.service';

describe('DownloadsService.enforceDailyCap', () => {
  let dataSource: DataSource;
  let service: DownloadsService;

  const userId = 'd2f7b5be-0f63-4d6f-a9e0-1d54c5f1ef01';

  beforeEach(async () => {
    dataSource = await createTestDataSource({
      synchronize: false,
      entities: [
        Product,
        Category,
        Tag,
        ProductAsset,
        ProductFile,
        Like,
        Bookmark,
        ProductDownload,
        User,
        UserRole,
        Role,
        Wallet,
        WalletTransaction,
      ],
    });
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "content"`);
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "analytics"`);
    await dataSource.synchronize();

    const storageService: StorageService = {
      saveUploadedFile: jest.fn(),
      getDownloadStream: jest.fn(),
      getDownloadUrl: jest.fn(),
      deleteFile: jest.fn(),
    };

    service = new DownloadsService(
      dataSource.getRepository(Product),
      dataSource.getRepository(ProductDownload),
      new CountersService(dataSource.getRepository(Product)),
      storageService,
    );
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('allows downloads when under the daily cap', async () => {
    const downloadsRepo = dataSource.getRepository(ProductDownload);
    await downloadsRepo.insert(
      Array.from({ length: 5 }).map(() =>
        downloadsRepo.create({
          productId: '1',
          userId,
        }),
      ),
    );

    await expect(service.enforceDailyCap(userId)).resolves.toBeUndefined();
  });

  it('rejects downloads when the daily cap is exceeded', async () => {
    const downloadsRepo = dataSource.getRepository(ProductDownload);
    await downloadsRepo.insert(
      Array.from({ length: 15 }).map(() =>
        downloadsRepo.create({
          productId: '2',
          userId,
        }),
      ),
    );

    await expect(service.enforceDailyCap(userId)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });
});

describe('DownloadsService.downloadProduct', () => {
  let dataSource: DataSource;
  let service: DownloadsService;
  let productsRepository: Repository<Product>;
  let productFilesRepository: Repository<ProductFile>;
  let product: Product;
  let storageService: jest.Mocked<StorageService>;

  const userId = 'e1a19ce1-77d9-4b34-ae2f-9d7f6c9f8f35';

  beforeEach(async () => {
    dataSource = await createTestDataSource({
      synchronize: false,
      entities: [
        Product,
        ProductFile,
        ProductAsset,
        Category,
        Tag,
        Like,
        Bookmark,
        ProductDownload,
        User,
        UserRole,
        Role,
        Wallet,
        WalletTransaction,
      ],
    });
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "content"`);
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "analytics"`);
    await dataSource.synchronize();

    productsRepository = dataSource.getRepository(Product);
    productFilesRepository = dataSource.getRepository(ProductFile);

    storageService = {
      saveUploadedFile: jest.fn(),
      getDownloadStream: jest.fn().mockReturnValue(Readable.from('test')),
      getDownloadUrl: jest.fn(),
      deleteFile: jest.fn(),
    } as unknown as jest.Mocked<StorageService>;

    service = new DownloadsService(
      productsRepository,
      dataSource.getRepository(ProductDownload),
      new CountersService(productsRepository),
      storageService,
    );

    const productSlug = `downloadable-${randomUUID()}`;

    product = await productsRepository.save(
      productsRepository.create({
        slug: productSlug,
        title: 'Downloadable Product',
        pricingType: PricingType.FREE,
      }),
    );

    const file = await productFilesRepository.save(
      productFilesRepository.create({
        storageKey: 'local-key',
        originalName: 'asset.zip',
        mimeType: 'application/zip',
        size: '2048',
      }),
    );

    await productsRepository
      .createQueryBuilder()
      .relation(Product, 'file')
      .of(product.id)
      .set(file.id);

    product = await productsRepository.findOneOrFail({
      where: { id: product.id },
      relations: ['file'],
    });
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('requires authentication', async () => {
    await expect(service.downloadProduct(product.id, undefined)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws when file is missing', async () => {
    const otherProduct = await productsRepository.save(
      productsRepository.create({
        slug: `no-file-${randomUUID()}`,
        title: 'No File Product',
        pricingType: PricingType.FREE,
      }),
    );

    await expect(service.downloadProduct(otherProduct.id, userId)).rejects.toThrow(
      'Product file not found',
    );
  });

  it('streams the file and increments counters', async () => {
    const result = await service.downloadProduct(product.id, userId);

    expect(Number(result.downloadsCount)).toBeGreaterThanOrEqual(1);
    expect(storageService.getDownloadStream).toHaveBeenCalledWith('local-key');
    expect(result.filename).toBe('asset.zip');
    expect(result.mimeType).toBe('application/zip');
  });

  it('enforces paid entitlement rules', async () => {
    await productsRepository.update(product.id, {
      pricingType: PricingType.PAID,
    });

    const paidSpy = jest
      .spyOn(service as any, 'checkPaidOwnership' as any)
      .mockResolvedValue(false as never);

    await expect(service.downloadProduct(product.id, userId)).rejects.toThrow(
      ForbiddenException,
    );

    (paidSpy as jest.SpyInstance).mockRestore();
  });
});









