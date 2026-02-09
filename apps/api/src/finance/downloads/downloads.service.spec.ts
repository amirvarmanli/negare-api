import { DownloadsService } from '@app/finance/downloads/downloads.service';
import { ProductsService } from '@app/finance/products/products.service';
import { EntitlementsService } from '@app/finance/entitlements/entitlements.service';
import { SubscriptionsService } from '@app/finance/subscriptions/subscriptions.service';
import { StorageService } from '@app/catalog/storage/storage.service';
import { PrismaService } from '@app/prisma/prisma.service';
import { ProductPricingType } from '@app/finance/common/finance.enums';
import { BASE_FREE_DAILY_LIMIT } from '@app/finance/common/finance.constants';
import { Readable } from 'node:stream';

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
    dailyUniqueCount?: number;
  }) => ({
    financeDownloadDailyUnique: {
      findUnique: jest.fn().mockResolvedValue(null),
      createMany: jest.fn().mockResolvedValue({
        count: overrides?.dailyUniqueCount ?? 1,
      }),
    },
    financeDownloadUsageDaily: {
      upsert: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: overrides?.updateCount ?? 1 }),
    },
    subscriptionDailyQuotaUsage: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({
        downloadsUsed: 0,
        downloadsLimitSnapshot: overrides?.updateCount ?? 1,
      }),
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
      financeDownloadUsageDaily: {
        findUnique: jest.fn(),
      },
      subscriptionDailyQuotaUsage: {
        findUnique: jest.fn(),
      },
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
      getLatestSubscription: jest.fn(),
      getPlanById: jest.fn(),
    };
    storageService = {
      getDownloadUrl: jest.fn().mockReturnValue('signed-url'),
      getDownloadStream: jest.fn(),
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
      dailyDownloadLimit: 0,
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

  it('returns limits for user without subscription', async () => {
    (prisma.financeDownloadUsageDaily!.findUnique as jest.Mock).mockResolvedValue({
      usedFree: 5,
    });
    (subscriptionsService.getActiveSubscription as jest.Mock).mockResolvedValue(null);
    (subscriptionsService.getLatestSubscription as jest.Mock).mockResolvedValue(null);

    const result = await service.getDownloadLimitsSummary('user-1');

    expect(result).toEqual(
      expect.objectContaining({
        freeDownloads: {
          used: 5,
          limit: BASE_FREE_DAILY_LIMIT,
          remaining: BASE_FREE_DAILY_LIMIT - 5,
        },
        subscriptionDownloads: {
          used: 0,
          limit: 0,
          remaining: 0,
        },
        hasActiveSubscription: false,
        subscriptionStatus: 'NONE',
      }),
    );
  });

  it('returns limits for user with active subscription', async () => {
    (prisma.financeDownloadUsageDaily!.findUnique as jest.Mock).mockResolvedValue({
      usedFree: 3,
    });
    (subscriptionsService.getActiveSubscription as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      planId: 'plan-1',
      planTitle: 'Pro',
      endAt: new Date('2026-03-01T00:00:00.000Z'),
    });
    (subscriptionsService.getPlanById as jest.Mock).mockResolvedValue({
      id: 'plan-1',
      title: 'Pro',
      dailyFreeDownloadLimitWithSubscription: 7,
      dailyDownloadLimit: 15,
    });
    (prisma.subscriptionDailyQuotaUsage!.findUnique as jest.Mock).mockResolvedValue({
      downloadsUsed: 2,
      downloadsLimitSnapshot: 15,
    });

    const result = await service.getDownloadLimitsSummary('user-1');

    expect(result).toEqual(
      expect.objectContaining({
        freeDownloads: {
          used: 3,
          limit: 7,
          remaining: 4,
        },
        subscriptionDownloads: {
          used: 2,
          limit: 15,
          remaining: 13,
        },
        hasActiveSubscription: true,
        subscriptionStatus: 'ACTIVE',
        subscriptionPlan: {
          id: 'plan-1',
          title: 'Pro',
          expiresAt: '2026-03-01T00:00:00.000Z',
        },
      }),
    );
  });

  it('returns zero remaining when limit is reached', async () => {
    (prisma.financeDownloadUsageDaily!.findUnique as jest.Mock).mockResolvedValue({
      usedFree: BASE_FREE_DAILY_LIMIT,
    });
    (subscriptionsService.getActiveSubscription as jest.Mock).mockResolvedValue(null);
    (subscriptionsService.getLatestSubscription as jest.Mock).mockResolvedValue(null);

    const result = await service.getDownloadLimitsSummary('user-1');

    expect(result.freeDownloads.remaining).toBe(0);
  });

  it('skips quota increment for duplicate same-day downloads', async () => {
    const tx = buildTx({ updateCount: 0, dailyUniqueCount: 0 });
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(tx),
    );
    (productsService.findProductOrThrow as jest.Mock).mockResolvedValue({
      id: 'dup-1',
      pricingType: ProductPricingType.FREE,
      price: 0,
    });
    (productsService.getProductStorageKey as jest.Mock).mockResolvedValue('storage-key');
    (entitlementsService.hasPurchased as jest.Mock).mockResolvedValue(false);
    (subscriptionsService.getActiveSubscription as jest.Mock).mockResolvedValue(null);

    await expect(service.downloadProduct('user-1', 'dup-1')).resolves.toBeDefined();

    expect(tx.financeDownloadUsageDaily.updateMany).not.toHaveBeenCalled();
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

  it('prefers product file mimeType and size for streams', async () => {
    const stream = Readable.from(['file']);
    (storageService.getDownloadStream as jest.Mock).mockReturnValue(stream);
    (prisma as Partial<PrismaService>).productFile = {
      findUnique: jest.fn().mockResolvedValue({
        id: BigInt(1),
        storageKey: 'storage-key',
        originalName: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 1234,
        sourceFile: { filename: 'source.png', mime: 'image/png', size: 9999 },
      }),
    };
    jest.spyOn(service, 'downloadProduct').mockResolvedValue({
      allowed: true,
      source: 'FREE_QUOTA',
      reason: 'FREE_QUOTA',
      productType: ProductPricingType.FREE,
      signedUrl: 'signed-url',
      storageKey: 'storage-key',
    });

    const result = await service.downloadProductStream('user-1', '1');

    expect(result.mimeType).toBe('image/jpeg');
    expect(result.size).toBe(1234);
    expect(result.filename).toBe('photo.jpg');
  });

  it('falls back to source file mimeType and size when product file metadata is missing', async () => {
    const stream = Readable.from(['file']);
    (storageService.getDownloadStream as jest.Mock).mockReturnValue(stream);
    (prisma as Partial<PrismaService>).productFile = {
      findUnique: jest.fn().mockResolvedValue({
        id: BigInt(2),
        storageKey: 'storage-key',
        originalName: null,
        mimeType: null,
        size: null,
        sourceFile: { filename: 'source.png', mime: 'image/png', size: 9999 },
      }),
    };
    jest.spyOn(service, 'downloadProduct').mockResolvedValue({
      allowed: true,
      source: 'FREE_QUOTA',
      reason: 'FREE_QUOTA',
      productType: ProductPricingType.FREE,
      signedUrl: 'signed-url',
      storageKey: 'storage-key',
    });

    const result = await service.downloadProductStream('user-1', '1');

    expect(result.mimeType).toBe('image/png');
    expect(result.size).toBe(9999);
    expect(result.filename).toBe('2.png');
  });

  it('defaults to application/octet-stream when mime is missing', async () => {
    const stream = Readable.from(['file']);
    (storageService.getDownloadStream as jest.Mock).mockReturnValue(stream);
    (prisma as Partial<PrismaService>).productFile = {
      findUnique: jest.fn().mockResolvedValue({
        id: BigInt(3),
        storageKey: 'storage-key',
        originalName: null,
        mimeType: null,
        size: 10,
        sourceFile: { filename: null, mime: null, size: null },
      }),
    };
    jest.spyOn(service, 'downloadProduct').mockResolvedValue({
      allowed: true,
      source: 'FREE_QUOTA',
      reason: 'FREE_QUOTA',
      productType: ProductPricingType.FREE,
      signedUrl: 'signed-url',
      storageKey: 'storage-key',
    });

    const result = await service.downloadProductStream('user-1', '1');

    expect(result.mimeType).toBe('application/octet-stream');
    expect(result.filename).toBe('3.bin');
  });

  it('throws NotFoundException when storageKey is missing', async () => {
    (prisma as Partial<PrismaService>).productFile = {
      findUnique: jest.fn().mockResolvedValue({
        id: BigInt(4),
        storageKey: null,
        originalName: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 1234,
        sourceFile: { filename: 'source.png', mime: 'image/png', size: 9999 },
      }),
    };

    await expect(service.downloadProductStream('user-1', '1')).rejects.toThrow(
      'File not found.',
    );
  });

  it('does not bypass subscription quota on retry', async () => {
    const usage = { downloadsUsed: 1, downloadsLimitSnapshot: 1 };
    const tx = {
      financeDownloadDailyUnique: {
        findUnique: jest.fn().mockResolvedValue(null),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      subscriptionDailyQuotaUsage: {
        findUnique: jest.fn().mockResolvedValue(usage),
        upsert: jest.fn().mockResolvedValue(usage),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    prisma.$transaction.mockImplementation(
      async (cb: (trx: typeof tx) => Promise<unknown>) => cb(tx),
    );

    const first = await (service as any).consumeSubscriptionQuota({
      userId: 'user-1',
      productId: '1',
      subscriptionId: 'sub-1',
      planId: 'plan-1',
      limit: 1,
    });
    const second = await (service as any).consumeSubscriptionQuota({
      userId: 'user-1',
      productId: '1',
      subscriptionId: 'sub-1',
      planId: 'plan-1',
      limit: 1,
    });

    expect(first.allowed).toBe(false);
    expect(second.allowed).toBe(false);
    expect(tx.financeDownloadDailyUnique.createMany).not.toHaveBeenCalled();
  });

  it('increments subscription quota on success', async () => {
    const usage = { downloadsUsed: 0, downloadsLimitSnapshot: 3 };
    const tx = {
      financeDownloadDailyUnique: {
        findUnique: jest.fn().mockResolvedValue(null),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      subscriptionDailyQuotaUsage: {
        findUnique: jest.fn().mockResolvedValue(usage),
        upsert: jest.fn().mockResolvedValue(usage),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    prisma.$transaction.mockImplementation(
      async (cb: (trx: typeof tx) => Promise<unknown>) => cb(tx),
    );

    const result = await (service as any).consumeSubscriptionQuota({
      userId: 'user-1',
      productId: '1',
      subscriptionId: 'sub-1',
      planId: 'plan-1',
      limit: 3,
    });

    expect(result.allowed).toBe(true);
    expect(result.used).toBe(1);
    expect(tx.subscriptionDailyQuotaUsage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { downloadsUsed: { increment: 1 } },
      }),
    );
    expect(tx.financeDownloadDailyUnique.createMany).toHaveBeenCalled();
  });

  it('returns not allowed when subscription limit is reached', async () => {
    const usage = { downloadsUsed: 2, downloadsLimitSnapshot: 2 };
    const tx = {
      financeDownloadDailyUnique: {
        findUnique: jest.fn().mockResolvedValue(null),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      subscriptionDailyQuotaUsage: {
        findUnique: jest.fn().mockResolvedValue(usage),
        upsert: jest.fn().mockResolvedValue(usage),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    prisma.$transaction.mockImplementation(
      async (cb: (trx: typeof tx) => Promise<unknown>) => cb(tx),
    );

    const result = await (service as any).consumeSubscriptionQuota({
      userId: 'user-1',
      productId: '1',
      subscriptionId: 'sub-1',
      planId: 'plan-1',
      limit: 2,
    });

    expect(result.allowed).toBe(false);
    expect(result.used).toBe(2);
  });
});
