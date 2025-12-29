import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AllConfig } from '@app/config/config.module';
import type {
  GatewayInitResult,
  GatewayVerifyResult,
  PaymentGateway,
  PaymentRequestMeta,
} from '@app/finance/payments/gateway/gateway.interface';
import { requestTraceStorage } from '@app/common/tracing/request-trace';

interface ZibalRequestPayload {
  merchant: string;
  amount: number;
  callbackUrl: string;
  description?: string;
  mobile?: string;
  orderId?: string;
  factorNumber?: string;
}

interface ZibalRequestResponse {
  trackId: number;
  result: number;
  message?: string;
  statusMessage?: string;
}

interface ZibalVerifyPayload {
  merchant: string;
  trackId: number | string;
}

interface ZibalVerifyResponse {
  result: number;
  status?: number;
  amount?: number;
  refNumber?: number;
  paidAt?: string;
  description?: string;
  orderId?: string;
  traceNumber?: number;
  cardNumber?: string;
  fee?: number;
  payer?: string;
}

@Injectable()
export class ZibalGatewayService implements PaymentGateway {
  private readonly logger = new Logger(ZibalGatewayService.name);
  private readonly timeoutMs = 15000;

  constructor(private readonly config: ConfigService<AllConfig>) {}

  async requestPayment(
    amount: number,
    meta: PaymentRequestMeta,
  ): Promise<GatewayInitResult> {
    const { merchant, baseUrl } = this.getConfig();
    const traceId = requestTraceStorage.getStore()?.traceId ?? 'unknown';

    const payload: ZibalRequestPayload = {
      merchant,
      amount,
      callbackUrl: meta.callbackUrl,
      description: meta.description,
      mobile: meta.mobile,
      orderId: meta.orderId,
      factorNumber: meta.factorNumber,
    };

    this.logger.log(
      `traceId=${traceId} Zibal request: orderId=${meta.orderId ?? 'n/a'} amount=${amount} callbackUrl=${meta.callbackUrl}`,
    );

    const response = await this.post<ZibalRequestResponse>(
      `${baseUrl}/v1/request`,
      payload,
    );

    this.logger.log(
      `traceId=${traceId} Zibal response: result=${response.result} trackId=${response.trackId ?? 'n/a'}`,
    );

    if (response.result !== 100) {
      const message =
        response.statusMessage ?? response.message ?? `result=${response.result}`;
      throw new BadRequestException(`Zibal request failed: ${message}`);
    }

    return {
      trackId: String(response.trackId),
      paymentUrl: `${baseUrl}/start/${response.trackId}`,
    };
  }

  async verifyPayment(trackId: string): Promise<GatewayVerifyResult> {
    const { merchant, baseUrl } = this.getConfig();
    const parsedTrackId = Number(trackId);
    const trackIdValue = Number.isFinite(parsedTrackId) ? parsedTrackId : trackId;

    const response = await this.post<ZibalVerifyResponse>(
      `${baseUrl}/v1/verify`,
      {
        merchant,
        trackId: trackIdValue,
      } satisfies ZibalVerifyPayload,
    );

    const ok = response.result === 100 && response.status === 1;
    const amount =
      typeof response.amount === 'number' ? response.amount : null;

    const paidAt = ok
      ? response.paidAt
        ? new Date(response.paidAt)
        : new Date()
      : null;

    return {
      ok,
      paidAt,
      amount,
      refId: response.refNumber ? String(response.refNumber) : null,
      raw: response,
    };
  }

  private getConfig() {
    const cfg = this.config.get('zibal', { infer: true });
    if (!cfg) {
      throw new BadGatewayException('Zibal config is missing.');
    }
    return {
      ...cfg,
      baseUrl: cfg.baseUrl.replace(/\/+$/, ''),
    };
  }

  private async post<T>(url: string, payload: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text();
        const details = this.compactText(text);
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${details}`);
      }
      const data = (await response.json()) as T;
      return data;
    } catch (error: unknown) {
      const traceId = requestTraceStorage.getStore()?.traceId ?? 'unknown';
      const message = this.describeFetchError(error);
      this.logger.error(`traceId=${traceId} Zibal request failed: ${message}`);
      throw new BadGatewayException(`Zibal request failed: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private describeFetchError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private compactText(value: string, maxLength = 200): string {
    const trimmed = value.trim().replace(/\s+/g, ' ');
    if (trimmed.length <= maxLength) {
      return trimmed;
    }
    return `${trimmed.slice(0, maxLength)}...`;
  }
}
