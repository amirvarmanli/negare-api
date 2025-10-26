import { DataSource } from 'typeorm';
import { createTestDataSource } from '../../tests/utils/test-database.util';
import { UsersService } from '@app/core/users/users.service';
import { User } from '@app/core/users/user.entity';
import { UserRole } from '@app/core/roles/entities/role.entity';
import { Role } from '@app/core/roles/entities/role.entity';
import { Wallet } from '@app/core/wallet/wallet.entity';
import { WalletTransaction } from '../../core/wallet-transactions/wallet-transaction.entity';

describe('UsersService', () => {
  let dataSource: DataSource;
  let service: UsersService;

  beforeEach(async () => {
    dataSource = await createTestDataSource({
      entities: [User, UserRole, Role, Wallet, WalletTransaction],
    });
    service = new UsersService(dataSource.getRepository(User));
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('creates a user with hashed password', async () => {
    const user = await service.create({
      username: 'john_doe',
      email: 'john@example.com',
      password: 'StrongPass123',
    });

    expect(user.id).toBeDefined();
    expect(user.username).toEqual('john_doe');

    const persisted = await dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: user.id })
      .getOneOrFail();

    expect(persisted.passwordHash).toBeDefined();
    expect(persisted.passwordHash).not.toEqual('StrongPass123');
    expect(persisted.passwordHash).toHaveLength(64);
  });

  it('filters users by search and activity', async () => {
    await service.create({
      username: 'active_user',
      email: 'active@example.com',
      isActive: true,
    });
    await service.create({
      username: 'inactive_user',
      email: 'inactive@example.com',
      isActive: false,
    });

    const activeUsers = await service.findAll({
      search: 'active',
      isActive: true,
      limit: 10,
    });

    expect(activeUsers).toHaveLength(1);
    expect(activeUsers[0].username).toEqual('active_user');
  });

  it('updates mutable fields and rehashes password', async () => {
    const created = await service.create({
      username: 'needs_update',
      email: 'old@example.com',
      password: 'InitialPass123',
    });

    const updated = await service.update(created.id, {
      email: 'new@example.com',
      password: 'NewPass456',
      isActive: false,
    });

    expect(updated.email).toEqual('new@example.com');
    expect(updated.isActive).toEqual(false);

    const persisted = await dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: created.id })
      .getOneOrFail();

    expect(persisted.passwordHash).not.toEqual('InitialPass123');
    expect(persisted.passwordHash).toHaveLength(64);
  });
});
