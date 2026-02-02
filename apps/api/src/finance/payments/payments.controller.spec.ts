import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { FinancePayment } from '@prisma/client';
import type { CurrentUserPayload } from '@app/common/decorators/current-user.decorator';
import type { AllConfig } from '@app/config/config.module';
import { PaymentsController } from '@app/finance/payments/payments.controller';
import type { PaymentsService } from '@app/finance/payments/payments.service';
import type { OrderRequestPaymentsService } from '@app/order-requests/order-request-payments.service';
import type { PaymentResultDto } from '@app/finance/payments/dto/payment-result.dto';
import {
  PaymentResultIntent,
  PaymentResultNextAction,
} from '@app/finance/payments/dto/payment-result.dto';
import {
  PaymentProvider,
  PaymentPurpose,
  PaymentReferenceType,
  PaymentSource,
  PaymentStatus,
  PaymentFulfillmentStatus,
} from '@app/finance/common/finance.enums';

const paymentResultFixture = (): PaymentResultDto => ({
  paymentId: '9b4f2b2d-1a0b-4b77-8f75-2f2f0c0a8a33',
  status: PaymentStatus.SUCCESS,
  source: PaymentSource.GATEWAY,
  provider: PaymentProvider.ZIBAL,
  amount: 150000,
  currency: 'TOMAN',
  purpose: PaymentPurpose.ORDER,
  referenceType: PaymentReferenceType.CART,
  referenceId: 'order-uuid',
  intent: PaymentResultIntent.PRODUCT,
  fulfillmentStatus: PaymentFulfillmentStatus.SUCCESS,
  fulfilledAt: '2026-02-02T12:05:03.000Z',
  verifiedAt: '2026-02-02T12:05:00.000Z',
  paidAt: '2026-02-02T12:05:00.000Z',
  failureReason: null,
  fulfillmentError: null,
  retryable: false,
  recommendedNextAction: PaymentResultNextAction.GO_TO_ORDER,
});

const paymentFixture = (): FinancePayment =>
  ({
    id: '9b4f2b2d-1a0b-4b77-8f75-2f2f0c0a8a33',
    userId: 'user-1',
  }) as FinancePayment;

const createController = () => {
  const paymentsService = {
    getPaymentById: jest.fn<Promise<FinancePayment>, [string, string]>(),
    getPaymentByTrackId: jest.fn<Promise<FinancePayment>, [string, string]>(),
    getPaymentByReference: jest.fn<
      Promise<FinancePayment>,
      [string, PaymentReferenceType, string]
    >(),
    getPaymentResultFromPayment: jest.fn<
      Promise<PaymentResultDto>,
      [string, FinancePayment]
    >(),
  };

  const photoRestorePayments = {
    getPaymentById: jest.fn(),
    getPaymentByTrackId: jest.fn(),
  };

  const config = {
    get: jest.fn(),
  } as unknown as ConfigService<AllConfig>;

  const controller = new PaymentsController(
    paymentsService as unknown as PaymentsService,
    config,
    photoRestorePayments as unknown as OrderRequestPaymentsService,
  );

  return { controller, paymentsService, photoRestorePayments };
};

describe('PaymentsController.getPaymentResultByQuery', () => {
  const user = { id: 'user-1' } as CurrentUserPayload;

  it('returns by paymentId when valid', async () => {
    const { controller, paymentsService } = createController();
    const payment = paymentFixture();
    const result = paymentResultFixture();

    paymentsService.getPaymentById.mockResolvedValue(payment);
    paymentsService.getPaymentResultFromPayment.mockResolvedValue(result);

    const response = await controller.getPaymentResultByQuery(
      { paymentId: payment.id },
      user,
    );

    expect(response).toBe(result);
    expect(paymentsService.getPaymentById).toHaveBeenCalledWith(
      user.id,
      payment.id,
    );
    expect(paymentsService.getPaymentByTrackId).not.toHaveBeenCalled();
  });

  it('rejects invalid paymentId', async () => {
    const { controller, paymentsService } = createController();

    await expect(
      controller.getPaymentResultByQuery({ paymentId: 'not-uuid' }, user),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(paymentsService.getPaymentById).not.toHaveBeenCalled();
  });

  it('returns by trackId when provided', async () => {
    const { controller, paymentsService } = createController();
    const payment = paymentFixture();
    const result = paymentResultFixture();

    paymentsService.getPaymentByTrackId.mockResolvedValue(payment);
    paymentsService.getPaymentResultFromPayment.mockResolvedValue(result);

    const response = await controller.getPaymentResultByQuery(
      { trackId: 'track-123' },
      user,
    );

    expect(response).toBe(result);
    expect(paymentsService.getPaymentByTrackId).toHaveBeenCalledWith(
      user.id,
      'track-123',
    );
    expect(paymentsService.getPaymentById).not.toHaveBeenCalled();
  });

  it('prioritizes paymentId over trackId', async () => {
    const { controller, paymentsService } = createController();
    const payment = paymentFixture();
    const result = paymentResultFixture();

    paymentsService.getPaymentById.mockResolvedValue(payment);
    paymentsService.getPaymentResultFromPayment.mockResolvedValue(result);

    const response = await controller.getPaymentResultByQuery(
      { paymentId: payment.id, trackId: 'track-should-ignore' },
      user,
    );

    expect(response).toBe(result);
    expect(paymentsService.getPaymentById).toHaveBeenCalledWith(
      user.id,
      payment.id,
    );
    expect(paymentsService.getPaymentByTrackId).not.toHaveBeenCalled();
  });

  it('rejects when no params provided', async () => {
    const { controller } = createController();

    await expect(
      controller.getPaymentResultByQuery({}, user),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
