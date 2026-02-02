import { ConfigService } from '@nestjs/config';
import {
  FinancePaymentStatus,
  RoleName,
} from '@prisma/client';
import { AdminUsersService } from '@app/core/users/admin/admin-users.service';
import { PrismaService } from '@app/prisma/prisma.service';
import type { AllConfig } from '@app/config/config.module';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prisma: Partial<PrismaService>;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (promises: Array<Promise<unknown>>) =>
        Promise.all(promises),
      ),
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      financeWallet: {
        findUnique: jest.fn(),
      },
      financeOrder: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      downloadEvent: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      financeWalletTransaction: {
        count: jest.fn(),
      },
      userNotification: {
        count: jest.fn(),
      },
      financeOrderRevenueSplit: {
        aggregate: jest.fn(),
      },
      financeSubscriptionSupplierEarning: {
        aggregate: jest.fn(),
      },
    } as Partial<PrismaService>;

    service = new AdminUsersService(
      prisma as PrismaService,
      {} as ConfigService<AllConfig>,
    );
  });

  it('returns pagination meta for list', async () => {
    (prisma.user!.count as jest.Mock).mockResolvedValue(41);
    (prisma.user!.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'user-1',
        avatarUrl: null,
        name: 'Ali',
        username: 'ali',
        phone: null,
        email: 'ali@example.com',
        city: 'Tehran',
        role: RoleName.user,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        userRoles: [],
        _count: { financeOrders: 2, downloadEvents: 5 },
      },
    ]);

    const result = await service.listUsers({ page: 2, limit: 20 });

    expect(result.meta).toEqual({
      page: 2,
      limit: 20,
      total: 41,
      totalPages: 3,
    });
  });

  it('applies search filters to list', async () => {
    (prisma.user!.count as jest.Mock).mockResolvedValue(0);
    (prisma.user!.findMany as jest.Mock).mockResolvedValue([]);

    await service.listUsers({ q: 'ali' });

    expect(prisma.user!.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { name: { contains: 'ali', mode: 'insensitive' } },
                { username: { contains: 'ali', mode: 'insensitive' } },
                { phone: { contains: 'ali', mode: 'insensitive' } },
                { email: { contains: 'ali', mode: 'insensitive' } },
                { city: { contains: 'ali', mode: 'insensitive' } },
              ]),
            }),
          ]),
        }),
      }),
    );
  });

  it('aggregates stats and financials for detail', async () => {
    (prisma.user!.findUnique as jest.Mock).mockResolvedValue({
      id: 'supplier-1',
      avatarUrl: null,
      name: 'Supplier',
      username: 'supplier',
      phone: null,
      email: 'supplier@example.com',
      city: 'Tehran',
      bio: null,
      role: RoleName.supplier,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      userRoles: [],
      skills: [
        {
          skill: {
            id: 'skill-1',
            key: 'illustration',
            nameFa: 'Illustration',
            nameEn: null,
          },
        },
      ],
    });

    (prisma.financeWallet!.findUnique as jest.Mock).mockResolvedValue({
      balance: 120000,
    });
    (prisma.financeOrder!.count as jest.Mock).mockResolvedValue(2);
    (prisma.downloadEvent!.count as jest.Mock).mockResolvedValue(7);
    (prisma.financeWalletTransaction!.count as jest.Mock).mockResolvedValue(3);
    (prisma.userNotification!.count as jest.Mock).mockResolvedValue(5);
    (prisma.financeOrderRevenueSplit!.aggregate as jest.Mock).mockResolvedValue({
      _sum: { amount: 100000 },
    });
    (prisma.financeSubscriptionSupplierEarning!.aggregate as jest.Mock).mockResolvedValue({
      _sum: { amount: 50000 },
    });

    const result = await service.getUserDetail('supplier-1');

    expect(result.financial).toEqual({
      walletBalance: 120000,
      supplierEarningsTotal: 150000,
    });
    expect(result.stats).toEqual({
      purchasesCount: 2,
      downloadsCount: 7,
      transactionsCount: 3,
      notificationsCount: 5,
    });
  });

  it('returns paginated purchases for user', async () => {
    (prisma.financeOrder!.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'order-1',
        createdAt: new Date('2025-01-02T00:00:00.000Z'),
        total: 45000,
        payments: [{ status: FinancePaymentStatus.SUCCESS }],
        items: [
          {
            product: { id: 12n, title: 'Poster Pack' },
          },
        ],
      },
    ]);
    (prisma.financeOrder!.count as jest.Mock).mockResolvedValue(41);

    const result = await service.listUserPurchases('user-1', {
      page: 2,
      limit: 20,
    });

    expect(result.meta).toEqual({
      page: 2,
      limit: 20,
      total: 41,
      totalPages: 3,
    });
    expect(result.items[0]).toEqual({
      id: 'order-1',
      createdAt: '2025-01-02T00:00:00.000Z',
      total: 45000,
      paymentStatus: 'SUCCESS',
      products: [{ id: '12', title: 'Poster Pack' }],
    });
  });

  it('returns paginated downloads for user with filters', async () => {
    (prisma.downloadEvent!.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'download-1',
        occurredAt: new Date('2025-01-03T10:00:00.000Z'),
        isFree: true,
        ip: '127.0.0.1',
        userAgent: 'Mozilla',
        product: { id: 12n, title: 'Poster Pack', slug: 'poster-pack' },
      },
    ]);
    (prisma.downloadEvent!.count as jest.Mock).mockResolvedValue(1);

    const result = await service.listUserDownloads('user-1', {
      page: 1,
      limit: 20,
      from: '2025-01-01',
      to: '2025-01-31',
      freeOnly: true,
    });

    expect(result.items[0]).toEqual({
      id: 'download-1',
      occurredAt: '2025-01-03T10:00:00.000Z',
      isFree: true,
      product: { id: '12', title: 'Poster Pack', slug: 'poster-pack' },
      ip: '127.0.0.1',
      userAgent: 'Mozilla',
    });
    expect(result.meta.total).toBe(1);
  });
});
