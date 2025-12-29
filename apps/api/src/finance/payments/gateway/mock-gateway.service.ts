import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  GatewayInitResult,
  GatewayVerifyResult,
  PaymentGateway,
  PaymentRequestMeta,
} from '@app/finance/payments/gateway/gateway.interface';

@Injectable()
export class MockGatewayService implements PaymentGateway {
  async requestPayment(
    amount: number,
    _meta: PaymentRequestMeta,
  ): Promise<GatewayInitResult> {
    const authority = `mock_${randomUUID()}`;
    return {
      trackId: authority,
      paymentUrl: `https://mock-gateway.local/pay/${authority}?amount=${amount}`,
    };
  }

  async verifyPayment(_trackId: string): Promise<GatewayVerifyResult> {
    return {
      ok: true,
      paidAt: new Date(),
      amount: null,
      refId: `ref_${randomUUID()}`,
      raw: { gateway: 'mock' },
    };
  }
}
