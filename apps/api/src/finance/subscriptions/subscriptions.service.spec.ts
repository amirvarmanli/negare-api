import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { SubscriptionPurchaseDto } from '@app/finance/subscriptions/dto/subscription-purchase.dto';
import { SubscriptionsService } from '@app/finance/subscriptions/subscriptions.service';
import {
  FinanceSubscriptionPurchase,
  SubscriptionPlan,
} from '@prisma/client';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: Partial<PrismaService>;

  beforeEach(() => {
    prisma = {
      subscriptionPlan: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      financeSubscriptionPurchase: {
        create: jest.fn(),
      },
    } as unknown as Partial<PrismaService>;
    service = new SubscriptionsService(prisma as PrismaService);
  });

  it('lists only active plans', async () => {
    const mockPlans: SubscriptionPlan[] = [
      {
        id: 'plan-1',
        title: 'Starter',
        price: 150000,
        durationDays: 30,
        dailySubscriptionDownloadLimit: 5,
        dailyFreeDownloadLimitWithSubscription: 10,
        description: 'Starter plan',
        isActive: true,
        discountPercent: null,
        discountQuota: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    (prisma.subscriptionPlan!.findMany as jest.Mock).mockResolvedValue(
      mockPlans,
    );

    const result = await service.listPlans();

    expect(result).toBe(mockPlans);
    expect(prisma.subscriptionPlan!.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
    });
  });

  describe('createSubscriptionPurchase', () => {
    const plan: SubscriptionPlan = {
      id: 'plan-2',
      title: 'Starter',
      price: 150000,
      durationDays: 30,
      dailySubscriptionDownloadLimit: 5,
      dailyFreeDownloadLimitWithSubscription: 10,
      description: 'Starter plan',
      isActive: true,
      discountPercent: null,
      discountQuota: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const purchase: FinanceSubscriptionPurchase = {
      id: 'purchase-1',
      userId: 'user-1',
      planId: plan.id,
      status: 'PENDING',
      amount: plan.price,
      currency: 'TOMAN',
      durationMonths: 1,
      createdAt: new Date(),
      paidAt: null,
      paymentId: null,
    } as unknown as FinanceSubscriptionPurchase;

    beforeEach(() => {
      (prisma.subscriptionPlan!.findUnique as jest.Mock).mockResolvedValue(plan);
      (prisma.financeSubscriptionPurchase!.create as jest.Mock).mockResolvedValue(
        purchase,
      );
    });

    it('creates purchase using planId', async () => {
      const dto = new SubscriptionPurchaseDto();
      dto.planId = plan.id;

      const result = await service.createSubscriptionPurchase('user-1', dto);

      expect(prisma.subscriptionPlan!.findUnique).toHaveBeenCalledWith({
        where: { id: plan.id },
      });
      expect(prisma.financeSubscriptionPurchase!.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          planId: null,
          subscriptionPlanId: plan.id,
          amount: plan.price,
        }),
      });
      expect(result.purchase).toBe(purchase);
      expect(result.plan).toBe(plan);
    });

    it('throws when plan is missing', async () => {
      const dto = new SubscriptionPurchaseDto();
      dto.planId = 'missing';
      (prisma.subscriptionPlan!.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createSubscriptionPurchase('user-1', dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when plan is inactive', async () => {
      const dto = new SubscriptionPurchaseDto();
      dto.planId = plan.id;
      const inactivePlan = { ...plan, isActive: false };
      (prisma.subscriptionPlan!.findUnique as jest.Mock).mockResolvedValue(
        inactivePlan,
      );

      await expect(
        service.createSubscriptionPurchase('user-1', dto),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
