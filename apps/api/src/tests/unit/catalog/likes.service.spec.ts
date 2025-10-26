import { DataSource } from 'typeorm';
import { createTestDataSource } from '../../utils/test-database.util';
import { LikesService } from '../../../catalog/likes/likes.service';
import { Like } from '../../../catalog/entities/content/like.entity';
import { Product, PricingType } from '../../../catalog/entities/content/product.entity';
import { Bookmark } from '../../../catalog/entities/content/bookmark.entity';
import { User } from '../../../core/users/user.entity';
import { UserRole } from '@app/core/roles/entities/role.entity';
import { Role } from '@app/core/roles/entities/role.entity';
import { Wallet } from '../../../core/wallets/wallet.entity';
import { WalletTransaction } from '../../../core/wallet-transactions/wallet-transaction.entity';
import { Category } from '../../../catalog/entities/content/category.entity';
import { Tag } from '../../../catalog/entities/content/tag.entity';
import { ProductAsset } from '../../../catalog/entities/content/product-asset.entity';
import { ProductFile } from '../../../catalog/entities/content/product-file.entity';

describe('LikesService', () => {
  let dataSource: DataSource;
  let service: LikesService;
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
        Like,
        Bookmark,
        User,
        UserRole,
        Role,
        Wallet,
        WalletTransaction,
      ],
    });

    await dataSource.query('CREATE SCHEMA IF NOT EXISTS "content"');
    await dataSource.query('CREATE SCHEMA IF NOT EXISTS "analytics"');
    await dataSource.synchronize();

    const usersRepository = dataSource.getRepository(User);
    user = await usersRepository.save(
      usersRepository.create({
        username: 'likes-user',
        email: null,
        phone: null,
        name: 'Likes User',
        bio: null,
        city: null,
        avatarUrl: null,
        isActive: true,
      }),
    );

    const productsRepository = dataSource.getRepository(Product);
    product = await productsRepository.save({
      slug: 'likes-product',
      title: 'Likes Product',
      pricingType: PricingType.FREE,
    } as Partial<Product>);

    service = new LikesService(
      dataSource,
      dataSource.getRepository(Like),
      productsRepository,
    );
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('increments and decrements like counts transactionally', async () => {
    const toggleOn = await service.toggleLike(user.id, product.id, undefined);
    expect(toggleOn.liked).toBe(true);
    expect(Number.parseInt(String(toggleOn.likesCount ?? 0), 10)).toBe(1);
    const likesRepository = dataSource.getRepository(Like);
    expect(
      await likesRepository.count({ where: { productId: product.id } }),
    ).toBe(1);

    const toggleOff = await service.toggleLike(user.id, product.id, undefined);
    expect(toggleOff.liked).toBe(false);
    expect(Number.parseInt(String(toggleOff.likesCount ?? 0), 10)).toBe(0);
    expect(
      await likesRepository.count({ where: { productId: product.id } }),
    ).toBe(0);
  });

  it('is idempotent when enforcing a desired like state', async () => {
    await service.toggleLike(user.id, product.id, true);
    const secondCall = await service.toggleLike(user.id, product.id, true);
    expect(secondCall.liked).toBe(true);
    expect(Number.parseInt(String(secondCall.likesCount ?? 0), 10)).toBe(1);

    const unset = await service.toggleLike(user.id, product.id, false);
    expect(unset.liked).toBe(false);
    expect(Number.parseInt(String(unset.likesCount ?? 0), 10)).toBe(0);
  });

  it('returns liked products ordered by most recent like', async () => {
    const productsRepository = dataSource.getRepository(Product);
    const olderProduct = await productsRepository.save({
      slug: 'likes-product-2',
      title: 'Likes Product 2',
      pricingType: PricingType.FREE,
    } as Partial<Product>);

    await service.toggleLike(user.id, olderProduct.id, true);
    await service.toggleLike(user.id, product.id, true);

    const page = await service.listLikedProducts(user.id, { page: 1, limit: 1 });
    expect(page.total).toBe(2);
    expect(page.hasNext).toBe(true);
    expect(String(page.data[0].id)).toBe(String(product.id));
  });
});
