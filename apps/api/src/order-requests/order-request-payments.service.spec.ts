import { OrderRequestPaymentsService } from '@app/order-requests/order-request-payments.service';
import { PrismaService } from '@app/prisma/prisma.service';
import { ZibalGatewayService } from '@app/finance/payments/gateway/zibal.gateway';
import {
  OrderRequestPaymentFulfillmentStatus,
  PaymentStatus,
} from '@prisma/client';

describe('OrderRequestPaymentsService', () => {
  let service: OrderRequestPaymentsService;
  let prisma: Partial<PrismaService>;
  let zibal: Partial<ZibalGatewayService>;

  beforeEach(() => {
    prisma = {
      payment: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    } as Partial<PrismaService>;
    zibal = {
      verifyPayment: jest.fn(),
    } as Partial<ZibalGatewayService>;
    service = new OrderRequestPaymentsService(
      prisma as PrismaService,
      zibal as ZibalGatewayService,
    );
  });

  it('verifies payment and creates order request', async () => {
    const payment = {
      id: 'payment-1',
      status: PaymentStatus.PENDING,
      trackId: 'track-1',
      amountToman: 120000,
      orderDraft: {
        fullName: 'A',
        messenger: 'telegram',
        phoneNumber: '123',
        imageCount: 2,
        amountToman: 120000,
        fileUrl: 'https://example.com/file.zip',
        fileSource: 'FRONTEND_UPLOAD',
      },
    } as any;

    (prisma.payment?.findUnique as jest.Mock).mockResolvedValue(payment);
    (zibal.verifyPayment as jest.Mock).mockResolvedValue({
      ok: true,
      amount: 1200000,
      refId: 'ref-1',
      raw: {},
    });

    const tx = {
      payment: {
        update: jest.fn(async ({ data }) => ({
          ...payment,
          ...data,
        })),
      },
      orderRequest: {
        create: jest.fn(async () => ({ id: 'order-1' })),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (tx: any) => Promise<unknown>) => cb(tx),
    );

    const result = await service.verifyPaymentById('payment-1');

    expect(tx.orderRequest.create).toHaveBeenCalled();
    expect(result.fulfillmentStatus).toBe(
      OrderRequestPaymentFulfillmentStatus.SUCCESS,
    );
  });

  it('fails when amount mismatches', async () => {
    const payment = {
      id: 'payment-2',
      status: PaymentStatus.PENDING,
      trackId: 'track-2',
      amountToman: 120000,
      orderDraft: {
        fullName: 'A',
        messenger: 'telegram',
        phoneNumber: '123',
        imageCount: 2,
        amountToman: 120000,
        fileUrl: 'https://example.com/file.zip',
        fileSource: 'FRONTEND_UPLOAD',
      },
    } as any;

    (prisma.payment?.findUnique as jest.Mock).mockResolvedValue(payment);
    (zibal.verifyPayment as jest.Mock).mockResolvedValue({
      ok: true,
      amount: 999,
      refId: 'ref-2',
      raw: {},
    });

    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (tx: any) => Promise<unknown>) =>
        cb({
          payment: {
            update: jest.fn(async ({ data }) => ({
              ...payment,
              ...data,
            })),
          },
        }),
    );

    const result = await service.verifyPaymentById('payment-2');

    expect(result.status).toBe(PaymentStatus.FAILED);
  });
});
