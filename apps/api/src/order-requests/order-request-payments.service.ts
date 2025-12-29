import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { PaymentStatus, Prisma } from '@prisma/client';
import type { OrderRequest } from '@prisma/client';
import { ZibalGatewayService } from '@app/finance/payments/gateway/zibal.gateway';
import type { Payment } from '@prisma/client';

@Injectable()
export class OrderRequestPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zibal: ZibalGatewayService,
  ) {}

  async getPaymentById(id: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      throw new NotFoundException('Payment not found.');
    }
    return payment;
  }

  async getPaymentStatus(
    id: string,
  ): Promise<{
    payment: Payment;
    imageCount?: number;
    fileUrl?: string;
    createdAt?: string;
  }> {
    const payment = await this.getPaymentById(id);
    if (payment.status === PaymentStatus.SUCCESS && payment.orderRequestId) {
      const orderRequest = await this.prisma.orderRequest.findUnique({
        where: { id: payment.orderRequestId },
        select: { imageCount: true, fileUrl: true, createdAt: true },
      });
      return {
        payment,
        imageCount: orderRequest?.imageCount,
        fileUrl: orderRequest?.fileUrl,
        createdAt: orderRequest?.createdAt?.toISOString(),
      };
    }

    const draft = this.extractDraft(payment.orderDraft);
    return {
      payment,
      imageCount: draft?.imageCount,
      fileUrl: draft?.fileUrl,
    };
  }

  async handleZibalCallback(
    trackId: string,
    rawQuery: Record<string, unknown>,
  ): Promise<Payment> {
    const payment = await this.prisma.payment.findFirst({
      where: { trackId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found for trackId.');
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        rawVerify: this.toJsonValue({ callback: rawQuery }),
      },
    });

    if (payment.status !== PaymentStatus.PENDING) {
      return payment;
    }

    return this.verifyAndUpdate(payment, rawQuery);
  }

  async verifyPaymentById(paymentId: string): Promise<Payment> {
    const payment = await this.getPaymentById(paymentId);
    if (payment.status !== PaymentStatus.PENDING) {
      return payment;
    }
    return this.verifyAndUpdate(payment, {});
  }

  private async verifyAndUpdate(
    payment: Payment,
    rawQuery: Record<string, unknown>,
  ): Promise<Payment> {
    if (!payment.trackId) {
      throw new BadRequestException('Payment has no trackId to verify.');
    }

    try {
      const result = await this.zibal.verifyPayment(payment.trackId);
      const status = result.ok
        ? PaymentStatus.SUCCESS
        : this.resolveFailureStatus(rawQuery);
      const rawResult = this.extractResultCode(result.raw);
      const message = this.extractMessage(result.raw);

      if (!result.ok) {
        return await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status,
            result: rawResult,
            message,
            transactionId: result.refId,
            rawVerify: this.toJsonValue({
              callback: rawQuery,
              verify: result.raw,
            }),
          },
        });
      }

      const updated = await this.prisma.$transaction(async (tx) => {
        const paymentRecord = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status,
            result: rawResult,
            message,
            transactionId: result.refId,
            rawVerify: this.toJsonValue({
              callback: rawQuery,
              verify: result.raw,
            }),
          },
        });

        if (paymentRecord.orderRequestId) {
          return paymentRecord;
        }

        const draft = this.parseOrderDraft(paymentRecord.orderDraft);
        if (!draft) {
          return paymentRecord;
        }

        const orderRequest = await tx.orderRequest.create({
          data: {
            fullName: draft.fullName,
            messenger: draft.messenger,
            phoneNumber: draft.phoneNumber,
            description: draft.description,
            imageCount: draft.imageCount,
            amountToman: draft.amountToman,
            fileUrl: draft.fileUrl,
            fileSource: draft.fileSource,
          },
        });

        return await tx.payment.update({
          where: { id: paymentRecord.id },
          data: { orderRequestId: orderRequest.id },
        });
      });

      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          message,
          rawVerify: this.toJsonValue({
            callback: rawQuery,
            error: message,
          }),
        },
      });
    }
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private resolveFailureStatus(
    rawQuery: Record<string, unknown>,
  ): PaymentStatus {
    const status = String(rawQuery.status ?? '').toLowerCase();
    const success = String(rawQuery.success ?? '').toLowerCase();
    if (success === '0' || status === '2' || status === '3') {
      return PaymentStatus.CANCELED;
    }
    return PaymentStatus.FAILED;
  }

  private extractResultCode(raw: unknown): number | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }
    const value = (raw as Record<string, unknown>).result;
    return typeof value === 'number' ? value : null;
  }

  private extractMessage(raw: unknown): string | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }
    const data = raw as Record<string, unknown>;
    const message = data.message ?? data.statusMessage;
    return typeof message === 'string' ? message : null;
  }

  private parseOrderDraft(
    draft: Prisma.JsonValue | null,
  ): PhotoRestoreOrderDraft | null {
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
      return null;
    }
    const data = draft as Record<string, unknown>;
    if (
      typeof data.fullName !== 'string' ||
      typeof data.messenger !== 'string' ||
      typeof data.phoneNumber !== 'string' ||
      typeof data.imageCount !== 'number' ||
      typeof data.amountToman !== 'number' ||
      typeof data.fileUrl !== 'string'
    ) {
      return null;
    }
    return {
      fullName: data.fullName,
      messenger: data.messenger as OrderRequest['messenger'],
      phoneNumber: data.phoneNumber,
      description: typeof data.description === 'string' ? data.description : null,
      imageCount: data.imageCount,
      amountToman: data.amountToman,
      fileUrl: data.fileUrl,
      fileSource:
        typeof data.fileSource === 'string' ? data.fileSource : null,
    };
  }

  private extractDraft(
    draft: Prisma.JsonValue | null,
  ): { imageCount?: number; fileUrl?: string } | null {
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
      return null;
    }
    const data = draft as Record<string, unknown>;
    const imageCount =
      typeof data.imageCount === 'number' ? data.imageCount : undefined;
    const fileUrl = typeof data.fileUrl === 'string' ? data.fileUrl : undefined;
    if (imageCount === undefined && fileUrl === undefined) {
      return null;
    }
    return { imageCount, fileUrl };
  }
}

interface PhotoRestoreOrderDraft {
  fullName: string;
  messenger: OrderRequest['messenger'];
  phoneNumber: string;
  description: string | null;
  imageCount: number;
  amountToman: number;
  fileUrl: string;
  fileSource: string | null;
}
