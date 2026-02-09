import { SubscriptionDownloadType } from '@app/finance/subscription-system/subscription-system.enums';
import { SubscriptionDownloadsService } from './subscription-downloads.service';
import { EntitlementsService } from '@app/finance/entitlements/entitlements.service';
import { ProductsService } from '@app/finance/products/products.service';
import { UserSubscriptionsService } from '@app/finance/subscription-system/user-subscriptions.service';
import { StorageService } from '@app/catalog/storage/storage.service';
import { PrismaService } from '@app/prisma/prisma.service';
import { ProductPricingType } from '@app/finance/common/finance.enums';

describe('SubscriptionDownloadsService', () => {
  let service: SubscriptionDownloadsService;
  let entitlementsService: Partial<EntitlementsService>;
  let productsService: Partial<ProductsService>;
  let subscriptionsService: Partial<UserSubscriptionsService>;
  let storage: Partial<StorageService>;

  beforeEach(() => {
    entitlementsService = { hasPurchased: jest.fn() };
    productsService = {
      findProductOrThrow: jest.fn().mockResolvedValue({
        pricingType: ProductPricingType.PAID,
      }),
      getProductStorageKey: jest.fn().mockResolvedValue('files/paid.zip'),
    };
    subscriptionsService = {
      getActiveSubscription: jest.fn().mockResolvedValue(null),
    };
    storage = {
      getDownloadUrl: jest.fn().mockReturnValue('https://cdn.example/files/paid.zip'),
    };
    service = new SubscriptionDownloadsService(
      {} as PrismaService,
      productsService as ProductsService,
      entitlementsService as EntitlementsService,
      subscriptionsService as UserSubscriptionsService,
      storage as StorageService,
    );
  });

  it('allows download when user holds a purchase entitlement', async () => {
    (entitlementsService.hasPurchased as jest.Mock).mockResolvedValue(true);
    const decision = await service.validateDownload('user-1', 'prod-1');
    expect(decision.allowed).toBe(true);
    expect(decision.downloadType).toBe(SubscriptionDownloadType.PURCHASED);
    expect(decision.storageKey).toBe('files/paid.zip');
    expect(storage.getDownloadUrl).toHaveBeenCalledWith('files/paid.zip');
  });

  it('throws when storage key is missing', async () => {
    (productsService.getProductStorageKey as jest.Mock).mockResolvedValue(null);
    await expect(service.validateDownload('user-1', 'prod-1')).rejects.toThrow(
      'File not found.',
    );
  });
});
