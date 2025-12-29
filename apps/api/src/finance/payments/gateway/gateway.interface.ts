export const PAYMENT_GATEWAY = 'PAYMENT_GATEWAY';

export interface PaymentRequestMeta {
  callbackUrl: string;
  description?: string;
  mobile?: string;
  orderId?: string;
  factorNumber?: string;
}

export interface GatewayInitResult {
  trackId: string;
  paymentUrl: string;
}

export interface GatewayVerifyResult {
  ok: boolean;
  paidAt: Date | null;
  amount: number | null;
  refId?: string | null;
  raw: unknown;
}

export interface PaymentGateway {
  requestPayment(amount: number, meta: PaymentRequestMeta): Promise<GatewayInitResult>;
  verifyPayment(trackId: string): Promise<GatewayVerifyResult>;
}
