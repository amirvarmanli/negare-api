import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import {
  PaymentProvider,
  PaymentStatus,
  PaymentFulfillmentStatus,
} from '@app/finance/common/finance.enums';
import { PaymentsService } from '@app/finance/payments/payments.service';
import { PaymentGateway } from '@app/finance/payments/gateway/gateway.interface';
import { MockGatewayService } from '@app/finance/payments/gateway/mock-gateway.service';
import { WalletService } from '@app/finance/wallet/wallet.service';
import { EntitlementsService } from '@app/finance/entitlements/entitlements.service';
import { RevenueService } from '@app/finance/revenue/revenue.service';
import { ProductsService } from '@app/finance/products/products.service';
import { SubscriptionsService } from '@app/finance/subscriptions/subscriptions.service';
import { DiscountsService } from '@app/finance/discounts/discounts.service';
import { CartService } from '@app/finance/cart/cart.service';
import { DonationsService } from '@app/finance/donations/donations.service';
import { NotificationsService } from '@app/notifications/notifications.service';
import { PrismaService } from '@app/prisma/prisma.service';

const basePayment = {
  id: 'payment-1',
  userId: 'user-1',
  orderId: 'order-1',
  provider: PaymentProvider.ZIBAL,
  status: PaymentStatus.PENDING,
  amount: 2000,
  fulfillmentStatus: PaymentFulfillmentStatus.PENDING,
  trackId: 'track-1',
} as any;

describe('PaymentsService gateway callbacks', () => {
  let service: PaymentsService;
  let prisma: Partial<PrismaService>;
  let gateway: Partial<PaymentGateway>;

  beforeEach(() => {
    prisma = {
      financePayment: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    } as Partial<PrismaService>;
    gateway = {
      verifyPayment: jest.fn(),
    } as Partial<PaymentGateway>;

    service = new PaymentsService(
      prisma as PrismaService,
      gateway as PaymentGateway,
      {} as MockGatewayService,
      {} as ConfigService<unknown>,
      {} as WalletService,
      {} as EntitlementsService,
      {} as RevenueService,
      {} as ProductsService,
      {} as SubscriptionsService,
      {} as DiscountsService,
      {} as CartService,
      {} as DonationsService,
      {} as NotificationsService,
    );
    jest
      .spyOn(service as any, 'notifyOrderEvents')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'notifyWalletCreditFromPayment')
      .mockResolvedValue(undefined);
  });

  it('verifies gateway payment and attempts fulfillment', async () => {
    (prisma.financePayment?.findFirst as jest.Mock).mockResolvedValue({
      ...basePayment,
    });
    (gateway.verifyPayment as jest.Mock).mockResolvedValue({
      ok: true,
      amount: 20000,
      refId: 'ref-1',
      paidAt: new Date(),
      raw: {},
    });

    const tx = {
      financePayment: {
        updateMany: jest.fn(async () => ({ count: 1 })),
        findUniqueOrThrow: jest.fn(async () => ({
          ...basePayment,
          status: PaymentStatus.SUCCESS,
        })),
        update: jest.fn(async ({ data }: { data: unknown }) => ({
          ...basePayment,
          status: PaymentStatus.SUCCESS,
          ...(data as object),
        })),
      },
    } as unknown as Prisma.TransactionClient;

    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        cb(tx),
    );
    jest
      .spyOn(service as any, 'fulfillPayment')
      .mockResolvedValue(undefined);

    const result = await service.handleZibalCallback('track-1');

    expect(result.status).toBe(PaymentStatus.SUCCESS);
  });

  it('retries fulfillment when callback is duplicated and fulfillment failed', async () => {
    (prisma.financePayment?.findFirst as jest.Mock).mockResolvedValue({
      ...basePayment,
      status: PaymentStatus.SUCCESS,
      fulfillmentStatus: PaymentFulfillmentStatus.FAILED,
    });
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        cb({
          financePayment: {
            findUniqueOrThrow: jest.fn(async () => ({
              ...basePayment,
              status: PaymentStatus.SUCCESS,
            })),
            update: jest.fn(async ({ data }: { data: unknown }) => ({
              ...basePayment,
              status: PaymentStatus.SUCCESS,
              ...(data as object),
            })),
          },
        } as unknown as Prisma.TransactionClient),
    );

    jest
      .spyOn(service as any, 'fulfillPayment')
      .mockResolvedValue(undefined);

    const result = await service.handleZibalCallback('track-1');

    expect(result.status).toBe(PaymentStatus.SUCCESS);
  });

  it('marks fulfillment failed when fulfillment throws', async () => {
    const tx = {
      financePayment: {
        update: jest.fn(async ({ data }: { data: unknown }) => ({
          ...basePayment,
          ...(data as object),
        })),
      },
    } as unknown as Prisma.TransactionClient;

    jest
      .spyOn(service as any, 'fulfillPayment')
      .mockRejectedValue(new Error('boom'));

    await (service as any).fulfillPaymentSafely(tx, {
      ...basePayment,
      fulfillmentStatus: PaymentFulfillmentStatus.PENDING,
    });

    expect(tx.financePayment.update).toHaveBeenCalled();
  });
});
