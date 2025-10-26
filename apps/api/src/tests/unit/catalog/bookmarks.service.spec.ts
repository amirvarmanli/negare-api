import { DataSource } from 'typeorm';
import { createTestDataSource } from '../../utils/test-database.util';
import { BookmarksService } from '../../../catalog/bookmarks/bookmarks.service';
import { Bookmark } from '../../../catalog/entities/content/bookmark.entity';
import { Like } from '../../../catalog/entities/content/like.entity';
import { Product, PricingType } from '../../../catalog/entities/content/product.entity';
import { User } from '../../../core/users/user.entity';
import { UserRole } from '@app/core/roles/entities/role.entity';
import { Role } from '@app/core/roles/entities/role.entity';
import { Wallet } from '../../../core/wallets/wallet.entity';
import { WalletTransaction } from '../../../core/wallet-transactions/wallet-transaction.entity';
import { Category } from '../../../catalog/entities/content/category.entity';
import { Tag } from '../../../catalog/entities/content/tag.entity';
import { ProductAsset } from '../../../catalog/entities/content/product-asset.entity';
import { ProductFile } from '../../../catalog/entities/content/product-file.entity';

describe('BookmarksService', () => {
  let dataSource: DataSource;
  let service: BookmarksService;
  let product: Product;
  let user: User;

  beforeEach(async () => {
    dataSource = await createTestDataSource({
      synchronize: false,
      entities: [
        Product,
        ProductAsset,
        ProductFile,
        Category,
        Tag,
        Bookmark,
        Like,
        User,
        UserRole,
        Role,
        Wallet,
        WalletTransaction,
      ],
    });

    await dataSource.query('CREATE SCHEMA IF NOT EXISTS "content"');
    await dataSource.synchronize();

    const usersRepository = dataSource.getRepository(User);
    user = await usersRepository.save(
      usersRepository.create({
        username: 'bookmarks-user',
        email: null,
        phone: null,
        name: 'Bookmarks User',
        bio: null,
        city: null,
        avatarUrl: null,
        isActive: true,
      }),
    );

    const productsRepository = dataSource.getRepository(Product);
    product = await productsRepository.save({
      slug: 'bookmarks-product',
      title: 'Bookmarks Product',
      pricingType: PricingType.FREE,
    } as Partial<Product>);

    service = new BookmarksService(
      dataSource.getRepository(Bookmark),
      productsRepository,
    );
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('toggles bookmarks without affecting like counters', async () => {
    const toggleOn = await service.toggleBookmark(user.id, product.id, undefined);
    expect(toggleOn.bookmarked).toBe(true);

    const productAfterBookmark = await dataSource
      .getRepository(Product)
      .findOne({ where: { id: product.id } });
    expect(Number(productAfterBookmark?.likesCount ?? 0)).toBe(0);

    const toggleOff = await service.toggleBookmark(user.id, product.id, undefined);
    expect(toggleOff.bookmarked).toBe(false);
  });

  it('is idempotent when enforcing bookmark state', async () => {
    await service.toggleBookmark(user.id, product.id, true);
    const second = await service.toggleBookmark(user.id, product.id, true);
    expect(second.bookmarked).toBe(true);

    const cleared = await service.toggleBookmark(user.id, product.id, false);
    expect(cleared.bookmarked).toBe(false);
  });

  it('returns bookmarked products ordered by most recent bookmark', async () => {
    const productsRepository = dataSource.getRepository(Product);
    const newerProduct = await productsRepository.save({
      slug: 'bookmarks-product-2',
      title: 'Bookmarks Product 2',
      pricingType: PricingType.FREE,
    } as Partial<Product>);

    await service.toggleBookmark(user.id, product.id, true);
    await service.toggleBookmark(user.id, newerProduct.id, true);

    const page = await service.listBookmarkedProducts(user.id, { page: 1, limit: 1 });
    expect(page.total).toBe(2);
    expect(page.hasNext).toBe(true);
    expect(String(page.data[0].id)).toBe(String(newerProduct.id));
  });
});
