import { ConfigService } from '@nestjs/config';
import { FinancePaymentStatus } from '@prisma/client';
import { PurchasesService, mapPaymentStatusToAdminStatus } from './purchases.service';
import { PrismaService } from '@app/prisma/prisma.service';
import { DownloadTokensService } from '@app/finance/downloads/download-tokens.service';
import { AdminPurchasePaymentStatus } from '@app/finance/purchases/dto/admin-purchases-query.dto';
import type { AllConfig } from '@app/config/config.module';

describe('PurchasesService (admin)', () => {
  let service: PurchasesService;
  let prisma: Partial<PrismaService>;

  beforeEach(() => {
    prisma = {
      financeOrder: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    } as Partial<PrismaService>;

    service = new PurchasesService(
      prisma as PrismaService,
      {} as DownloadTokensService,
      {} as ConfigService<AllConfig>,
    );
  });

  it('returns correct pagination meta', async () => {
    (prisma.financeOrder!.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'order-1',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        total: 120000,
        user: {
          id: 'user-1',
          name: 'Ali',
          firstName: null,
          lastName: null,
          username: null,
          phone: null,
          email: 'ali@example.com',
        },
        items: [{ product: { id: 12n, title: 'Bundle' } }],
        payments: [
          {
            id: 'payment-1',
            provider: 'ZIBAL',
            trackId: 'track-1',
            refId: 'ref-1',
            status: FinancePaymentStatus.SUCCESS,
            createdAt: new Date('2025-01-01T00:00:00.000Z'),
          },
        ],
      },
    ]);
    (prisma.financeOrder!.count as jest.Mock).mockResolvedValue(41);

    const result = await service.listAdminPurchases({ page: 2, limit: 20 });

    expect(result.meta).toEqual({
      page: 2,
      limit: 20,
      total: 41,
      totalPages: 3,
    });
  });

  it('filters by status using payment statuses', async () => {
    (prisma.financeOrder!.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.financeOrder!.count as jest.Mock).mockResolvedValue(0);

    await service.listAdminPurchases({
      status: AdminPurchasePaymentStatus.SUCCESS,
    });

    expect(prisma.financeOrder!.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          payments: {
            some: { status: { in: [FinancePaymentStatus.SUCCESS] } },
          },
        }),
      }),
    );
  });
});

describe('mapPaymentStatusToAdminStatus', () => {
  it('maps success', () => {
    expect(mapPaymentStatusToAdminStatus(FinancePaymentStatus.SUCCESS)).toBe(
      AdminPurchasePaymentStatus.SUCCESS,
    );
  });

  it('maps pending', () => {
    expect(mapPaymentStatusToAdminStatus(FinancePaymentStatus.PENDING)).toBe(
      AdminPurchasePaymentStatus.PENDING,
    );
  });

  it('maps failed and canceled', () => {
    expect(mapPaymentStatusToAdminStatus(FinancePaymentStatus.FAILED)).toBe(
      AdminPurchasePaymentStatus.FAILED,
    );
    expect(mapPaymentStatusToAdminStatus(FinancePaymentStatus.CANCELED)).toBe(
      AdminPurchasePaymentStatus.FAILED,
    );
  });

  it('defaults to pending when missing', () => {
    expect(mapPaymentStatusToAdminStatus(undefined)).toBe(
      AdminPurchasePaymentStatus.PENDING,
    );
  });
});
