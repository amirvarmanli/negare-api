import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SupplierOwnershipGuard } from '../../../catalog/guards/supplier-ownership.guard';
import { createTestDataSource } from '../../utils/test-database.util';
import { Product, PricingType } from '../../../catalog/entities/content/product.entity';
import { Category } from '../../../catalog/entities/content/category.entity';
import { Tag } from '../../../catalog/entities/content/tag.entity';
import { ProductAsset } from '../../../catalog/entities/content/product-asset.entity';
import { ProductFile } from '../../../catalog/entities/content/product-file.entity';
import { Like } from '../../../catalog/entities/content/like.entity';
import { Bookmark } from '../../../catalog/entities/content/bookmark.entity';
import { User } from '../../../core/users/user.entity';
import { UserRole } from '@app/core/roles/entities/role.entity';
import { Role, RoleName } from '@app/core/roles/entities/role.entity';
import { Wallet } from '../../../core/wallets/wallet.entity';
import { WalletTransaction } from '../../../core/wallet-transactions/wallet-transaction.entity';

function createExecutionContext(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('SupplierOwnershipGuard', () => {
  let dataSource: DataSource;
  let guard: SupplierOwnershipGuard;

  beforeEach(async () => {
    dataSource = await createTestDataSource({
      synchronize: false,
      entities: [Product, ProductAsset, ProductFile, Category, Tag, Like, Bookmark, User, UserRole, Role, Wallet, WalletTransaction],
    });
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "content"`);
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "analytics"`);
    await dataSource.synchronize();
    guard = new SupplierOwnershipGuard(dataSource.getRepository(Product));
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('allows admin users to bypass supplier check', async () => {
    const request = {
      params: { id: '1' },
      user: { id: 'admin-id', roles: [RoleName.ADMIN] },
    };

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).resolves.toBe(true);
  });

  it('allows owning supplier to manage the product', async () => {
    const usersRepo = dataSource.getRepository(User);
    const productsRepo = dataSource.getRepository(Product);

    const supplier = await usersRepo.save(
      usersRepo.create({
        username: 'supplier_owner',
      }),
    );

    const product = await productsRepo.save(
      productsRepo.create({
        slug: 'owned-product',
        title: 'Owned Product',
        pricingType: PricingType.FREE,
        active: true,
        suppliers: [supplier],
      }),
    );

    const request = {
      params: { id: product.id },
      user: { id: supplier.id, roles: [RoleName.SUPPLIER] },
    };

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).resolves.toBe(true);
  });

  it('rejects supplier without ownership', async () => {
    const usersRepo = dataSource.getRepository(User);
    const productsRepo = dataSource.getRepository(Product);

    const owner = await usersRepo.save(
      usersRepo.create({ username: 'owner_supplier' }),
    );
    const other = await usersRepo.save(
      usersRepo.create({ username: 'other_supplier' }),
    );

    const product = await productsRepo.save(
      productsRepo.create({
        slug: 'restricted-product',
        title: 'Restricted Product',
        pricingType: PricingType.FREE,
        active: true,
        suppliers: [owner],
      }),
    );

    const request = {
      params: { id: product.id },
      user: { id: other.id, roles: [RoleName.SUPPLIER] },
    };

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});














