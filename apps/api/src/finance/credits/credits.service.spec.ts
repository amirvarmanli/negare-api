import { CreditsService } from '@app/finance/credits/credits.service';
import { AdminCreditType } from '@app/finance/credits/dto/admin-credits-query.dto';
import { PrismaService } from '@app/prisma/prisma.service';

describe('CreditsService (admin)', () => {
  let service: CreditsService;
  let prisma: Partial<PrismaService>;

  beforeEach(() => {
    prisma = {
      financeOrderRevenueSplit: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      financeSubscriptionSupplierEarning: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
    } as Partial<PrismaService>;

    service = new CreditsService(prisma as PrismaService);
  });

  it('returns correct pagination meta', async () => {
    (prisma.financeOrderRevenueSplit!.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.financeSubscriptionSupplierEarning!.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.financeOrderRevenueSplit!.count as jest.Mock).mockResolvedValue(41);
    (prisma.financeSubscriptionSupplierEarning!.count as jest.Mock).mockResolvedValue(9);

    const result = await service.listAdminCredits({ page: 2, limit: 20 });

    expect(result.meta).toEqual({
      page: 2,
      limit: 20,
      total: 50,
      totalPages: 3,
    });
  });

  it('filters by type', async () => {
    (prisma.financeSubscriptionSupplierEarning!.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.financeSubscriptionSupplierEarning!.count as jest.Mock).mockResolvedValue(0);

    await service.listAdminCredits({ type: AdminCreditType.SUBSCRIPTION_PURCHASE });

    expect(prisma.financeOrderRevenueSplit!.findMany).not.toHaveBeenCalled();
    expect(prisma.financeSubscriptionSupplierEarning!.findMany).toHaveBeenCalled();
  });

  it('filters by supplierId', async () => {
    (prisma.financeOrderRevenueSplit!.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.financeOrderRevenueSplit!.count as jest.Mock).mockResolvedValue(0);

    await service.listAdminCredits({
      type: AdminCreditType.PRODUCT_PURCHASE,
      supplierId: 'supplier-1',
    });

    expect(prisma.financeOrderRevenueSplit!.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ supplierId: 'supplier-1' }]),
        }),
      }),
    );
  });

  it('applies supplier search in q filter', async () => {
    (prisma.user!.findMany as jest.Mock).mockResolvedValue([
      { id: 'supplier-1' },
    ]);
    (prisma.financeOrderRevenueSplit!.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.financeOrderRevenueSplit!.count as jest.Mock).mockResolvedValue(0);

    await service.listAdminCredits({
      type: AdminCreditType.PRODUCT_PURCHASE,
      q: 'ali',
    });

    expect(prisma.user!.findMany).toHaveBeenCalled();
    expect(prisma.financeOrderRevenueSplit!.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            {
              OR: expect.arrayContaining([
                { supplierId: { in: ['supplier-1'] } },
              ]),
            },
          ]),
        }),
      }),
    );
  });
});
