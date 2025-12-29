import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@app/prisma/prisma.service';
import type { AllConfig } from '@app/config/config.module';
import type { OrderRequest, Payment } from '@prisma/client';
import { OrderRequestPaymentPurpose, PaymentStatus, Prisma } from '@prisma/client';
import { ORDER_REQUEST_IMAGE_PRICE_TOMAN } from '@app/order-requests/order-requests.constants';
import type { CreateOrderRequestDto } from '@app/order-requests/dto/create-order-request.dto';
import { ZibalGatewayService } from '@app/finance/payments/gateway/zibal.gateway';

@Injectable()
export class OrderRequestsService {
  private readonly gatewayName = 'ZIBAL';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AllConfig>,
    private readonly zibal: ZibalGatewayService,
  ) {}

  async requestPayment(
    dto: CreateOrderRequestDto,
  ): Promise<{ payment: Payment }> {
    this.ensureAllowedFileUrl(dto.fileUrl);
    const amountToman = dto.imageCount * ORDER_REQUEST_IMAGE_PRICE_TOMAN;

    let payment = await this.prisma.payment.create({
      data: {
        gateway: this.gatewayName,
        purpose: OrderRequestPaymentPurpose.PHOTO_RESTORE,
        amountToman,
        status: PaymentStatus.PENDING,
        orderDraft: this.toJsonValue({
          fullName: dto.fullName,
          messenger: dto.messenger,
          phoneNumber: dto.phoneNumber,
          description: dto.description ?? null,
          imageCount: dto.imageCount,
          amountToman,
          fileUrl: dto.fileUrl,
          fileSource: 'FRONTEND_UPLOAD',
        }),
      },
    });

    const callbackUrl = this.getCallbackUrl();

    try {
      const gatewayResult = await this.zibal.requestPayment(
        this.toIrrAmount(amountToman),
        {
          callbackUrl,
          description: `PhotoRestoreRequest ${payment.id}`,
          mobile: dto.phoneNumber,
          orderId: payment.id,
        },
      );

      payment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          trackId: gatewayResult.trackId,
          redirectUrl: gatewayResult.paymentUrl,
          result: 100,
          rawRequest: this.toJsonValue({
            meta: {
              orderId: payment.id,
              amountToman,
              amountRial: this.toIrrAmount(amountToman),
            },
          }),
        },
      });
    } catch (error) {
      if (
        payment.status === PaymentStatus.FAILED &&
        error instanceof BadGatewayException
      ) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          message,
          rawRequest: this.toJsonValue({
            error: message,
          }),
        },
      });
      throw new BadGatewayException(`Zibal request failed: ${message}`);
    }

    return { payment };
  }

  async getOrderRequestById(id: string) {
    const orderRequest = await this.prisma.orderRequest.findUnique({
      where: { id },
      include: { payment: true },
    });

    if (!orderRequest) {
      throw new NotFoundException('Order request not found.');
    }

    return orderRequest;
  }

  private ensureAllowedFileUrl(fileUrl: string): void {
    let parsed: URL;
    try {
      parsed = new URL(fileUrl);
    } catch {
      throw new BadRequestException('fileUrl must be a valid URL.');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('fileUrl must use http or https.');
    }

    const allowlist = this.getAllowedDomains();
    if (allowlist && allowlist.length > 0) {
      const host = parsed.hostname.toLowerCase();
      const allowed = allowlist.some((domain) => host === domain);
      if (!allowed) {
        throw new BadRequestException('fileUrl domain is not allowed.');
      }
    }
  }

  private getCallbackUrl(): string {
    const cfg = this.config.get('zibal', { infer: true });
    if (!cfg?.callbackUrl) {
      throw new BadRequestException('Zibal callback URL is not configured.');
    }
    return cfg.callbackUrl;
  }

  private getAllowedDomains(): string[] | null {
    const raw = this.config.get<string>('PHOTO_RESTORE_ALLOWED_DOMAINS');
    if (!raw) {
      return null;
    }
    const domains = raw
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    return domains.length > 0 ? domains : null;
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private toIrrAmount(amountToman: number): number {
    return amountToman * 10;
  }
}
