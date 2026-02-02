import { DownloadsService } from '@app/finance/downloads/downloads.service';
import { ProductsService } from '@app/finance/products/products.service';
import { EntitlementsService } from '@app/finance/entitlements/entitlements.service';
import { SubscriptionsService } from '@app/finance/subscriptions/subscriptions.service';
import { StorageService } from '@app/catalog/storage/storage.service';
import { PrismaService } from '@app/prisma/prisma.service';
import { ProductPricingType } from '@app/finance/common/finance.enums';
import { BASE_FREE_DAILY_LIMIT } from '@app/finance/common/finance.constants';

describe('DownloadsService', () => {
  let service: DownloadsService;
  let prisma: {
    $transaction: jest.Mock;
  } & Partial<PrismaService>;
  let productsService: Partial<ProductsService>;
  let entitlementsService: Partial<EntitlementsService>;
  let subscriptionsService: Partial<SubscriptionsService>;
  let storageService: Partial<StorageService>;

  const buildTx = (overrides?: {
    updateCount?: number;
  }) => ({
    financeDownloadUsageDaily: {
      upsert: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: overrides?.updateCount ?? 1 }),
    },
    financeDownloadLog: {
      create: jest.fn(),
    },
    downloadEvent: {
      create: jest.fn(),
    },
  });

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
    };
    productsService = {
      findProductOrThrow: jest.fn(),
      getProductStorageKey: jest.fn(),
    };
    entitlementsService = {
      hasPurchased: jest.fn(),
    };
    subscriptionsService = {
      getActiveSubscription: jest.fn(),
      getPlanById: jest.fn(),
    };
    storageService = {
      getDownloadUrl: jest.fn().mockReturnValue('signed-url'),
    };

    service = new DownloadsService(
      prisma as PrismaService,
      productsService as ProductsService,
      entitlementsService as EntitlementsService,
      subscriptionsService as SubscriptionsService,
      storageService as StorageService,
    );
  });

  it('applies base free limit for non-subscribers', async () => {
    const tx = buildTx();
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(tx),
    );
    (productsService.findProductOrThrow as jest.Mock).mockResolvedValue({
      id: '1',
      pricingType: ProductPricingType.FREE,
      price: 0,
    });
    (productsService.getProductStorageKey as jest.Mock).mockResolvedValue('storage-key');
    (entitlementsService.hasPurchased as jest.Mock).mockResolvedValue(false);
    (subscriptionsService.getActiveSubscription as jest.Mock).mockResolvedValue(null);

    await service.downloadProduct('user-1', '1');

    expect(tx.financeDownloadUsageDaily.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          usedFree: { lt: BASE_FREE_DAILY_LIMIT },
        }),
      }),
    );
  });

  it('uses subscription daily free limit when available', async () => {
    const tx = buildTx();
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(tx),
    );
    (productsService.findProductOrThrow as jest.Mock).mockResolvedValue({
      id: '2',
      pricingType: ProductPricingType.FREE,
      price: 0,
    });
    (productsService.getProductStorageKey as jest.Mock).mockResolvedValue('storage-key');
    (entitlementsService.hasPurchased as jest.Mock).mockResolvedValue(false);
    (subscriptionsService.getActiveSubscription as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      planId: 'plan-1',
    });
    (subscriptionsService.getPlanById as jest.Mock).mockResolvedValue({
      dailyFreeDownloadLimitWithSubscription: 5,
      dailySubscriptionDownloadLimit: 0,
    });

    await service.downloadProduct('user-1', '2');

    expect(tx.financeDownloadUsageDaily.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          usedFree: { lt: 5 },
        }),
      }),
    );
  });

  it('increments free download usage on success', async () => {
    const tx = buildTx();
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(tx),
    );
    (productsService.findProductOrThrow as jest.Mock).mockResolvedValue({
      id: '3',
      pricingType: ProductPricingType.FREE,
      price: 0,
    });
    (productsService.getProductStorageKey as jest.Mock).mockResolvedValue('storage-key');
    (entitlementsService.hasPurchased as jest.Mock).mockResolvedValue(false);
    (subscriptionsService.getActiveSubscription as jest.Mock).mockResolvedValue(null);

    await service.downloadProduct('user-1', '3');

    expect(tx.financeDownloadUsageDaily.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { usedFree: { increment: 1 } },
      }),
    );
    expect(tx.downloadEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isFree: true }),
      }),
    );
    expect(storageService.getDownloadUrl).toHaveBeenCalledWith('storage-key');
  });

  it('blocks when free limit is exceeded', async () => {
    const tx = buildTx({ updateCount: 0 });
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(tx),
    );
    (productsService.findProductOrThrow as jest.Mock).mockResolvedValue({
      id: '4',
      pricingType: ProductPricingType.FREE,
      price: 0,
    });
    (productsService.getProductStorageKey as jest.Mock).mockResolvedValue('storage-key');
    (entitlementsService.hasPurchased as jest.Mock).mockResolvedValue(false);
    (subscriptionsService.getActiveSubscription as jest.Mock).mockResolvedValue(null);

    await expect(service.downloadProduct('user-1', '4')).rejects.toThrow(
      'سقف دانلود روزانه محصولات رایگان به پایان رسیده است.',
    );
  });

  it('throws when free product has no file', async () => {
    const tx = buildTx();
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(tx),
    );
    (productsService.findProductOrThrow as jest.Mock).mockResolvedValue({
      id: '5',
      pricingType: ProductPricingType.FREE,
      price: 0,
    });
    (productsService.getProductStorageKey as jest.Mock).mockResolvedValue(null);
    (entitlementsService.hasPurchased as jest.Mock).mockResolvedValue(false);
    (subscriptionsService.getActiveSubscription as jest.Mock).mockResolvedValue(null);

    await expect(service.downloadProduct('user-1', '5')).rejects.toThrow(
      'فایل محصول یافت نشد.',
    );
  });

  it('rejects paid product without entitlement', async () => {
    (productsService.findProductOrThrow as jest.Mock).mockResolvedValue({
      id: '6',
      pricingType: ProductPricingType.PAID,
      price: 100,
    });
    (productsService.getProductStorageKey as jest.Mock).mockResolvedValue('storage-key');
    (entitlementsService.hasPurchased as jest.Mock).mockResolvedValue(false);

    await expect(service.downloadProduct('user-1', '6')).rejects.toThrow(
      'برای دانلود نیاز به خرید محصول است.',
    );
  });

  it('requires subscription for subscription-only products', async () => {
    (productsService.findProductOrThrow as jest.Mock).mockResolvedValue({
      id: '7',
      pricingType: ProductPricingType.PAID_OR_SUBSCRIPTION,
      price: 0,
    });
    (productsService.getProductStorageKey as jest.Mock).mockResolvedValue('storage-key');
    (entitlementsService.hasPurchased as jest.Mock).mockResolvedValue(false);
    (subscriptionsService.getActiveSubscription as jest.Mock).mockResolvedValue(null);

    await expect(service.downloadProduct('user-1', '7')).rejects.toThrow(
      'برای دانلود نیاز به اشتراک فعال است.',
    );
  });
});
