import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@app/prisma/prisma.service';
import {
  DonationStatus,
  PaymentProvider,
  PaymentPurpose,
  PaymentReferenceType,
  PaymentStatus,
} from '@app/finance/common/finance.enums';
import {
  DONATION_MAX_AMOUNT,
  DONATION_MIN_AMOUNT,
} from '@app/finance/donations/donations.constants';
import {
  PAYMENT_GATEWAY,
  PaymentGateway,
} from '@app/finance/payments/gateway/gateway.interface';
import type {
  FinanceDonationStatus,
  FinancePaymentProvider,
  FinancePaymentPurpose,
  FinancePaymentReferenceType,
  FinancePaymentStatus,
  Prisma,
} from '@prisma/client';
import type { AllConfig } from '@app/config/config.module';
import type { DonationInitResponseDto } from '@app/finance/donations/dto/donation-init-response.dto';
import type { DonationResultDto } from '@app/finance/donations/dto/donation-result.dto';

@Injectable()
export class DonationsService {
  private readonly logger = new Logger(DonationsService.name);
  private readonly zibalMinAmountToman = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AllConfig>,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
  ) {}

  async initDonation(
    userId: string,
    amount: number,
  ): Promise<DonationInitResponseDto> {
    this.ensureDonationAmount(amount);
    this.ensureZibalAmount(amount);

    const init = await this.gateway.requestPayment(this.toIrrAmount(amount), {
      callbackUrl: this.getZibalCallbackUrl(),
      description: 'Donation support',
    });

    const { donation, payment } = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const donation = await tx.financeDonation.create({
          data: {
            userId,
            amount,
            status: DonationStatus.PENDING as FinanceDonationStatus,
            gatewayTrackId: init.trackId,
            referenceId: null,
          },
        });

        const payment = await tx.financePayment.create({
          data: {
            orderId: null,
            userId,
            purpose: PaymentPurpose.DONATION as FinancePaymentPurpose,
            referenceType:
              PaymentReferenceType.DONATION as FinancePaymentReferenceType,
            referenceId: donation.id,
            provider: PaymentProvider.ZIBAL as FinancePaymentProvider,
            status: PaymentStatus.PENDING as FinancePaymentStatus,
            amount,
            currency: 'TOMAN',
            trackId: init.trackId,
            authority: init.trackId,
            refId: null,
            verifiedAt: null,
            paidAt: null,
            meta: { gateway: 'zibal', donationId: donation.id },
          },
        });

        return { donation, payment };
      },
      { maxWait: 10000, timeout: 20000 },
    );

    this.logger.log(
      `Donation init userId=${userId} donationId=${donation.id} paymentId=${payment.id} trackId=${payment.trackId ?? 'n/a'}`,
    );

    return {
      donationId: donation.id,
      paymentId: payment.id,
      trackId: payment.trackId ?? init.trackId,
      redirectUrl: init.paymentUrl,
      amount,
    };
  }

  async getDonationResult(
    userId: string,
    donationId: string,
  ): Promise<DonationResultDto> {
    const donation = await this.prisma.financeDonation.findUnique({
      where: { id: donationId },
    });
    if (!donation) {
      throw new NotFoundException('Donation not found.');
    }
    if (donation.userId !== userId) {
      throw new ForbiddenException('Access denied.');
    }

    const status = donation.status as DonationStatus;
    return {
      amount: donation.amount,
      status,
      message: this.buildDonationMessage(status),
      referenceId: donation.referenceId ?? null,
    };
  }

  private buildDonationMessage(status: DonationStatus): string {
    if (status === DonationStatus.SUCCESS) {
      return 'Thank you for your support.';
    }
    if (status === DonationStatus.FAILED) {
      return 'Donation payment failed.';
    }
    return 'Donation payment is pending.';
  }

  private ensureDonationAmount(amount: number): void {
    if (!Number.isFinite(amount)) {
      throw new BadRequestException('Amount must be a valid number.');
    }
    if (amount < DONATION_MIN_AMOUNT || amount > DONATION_MAX_AMOUNT) {
      throw new BadRequestException(
        `Amount must be between ${DONATION_MIN_AMOUNT} and ${DONATION_MAX_AMOUNT} TOMAN.`,
      );
    }
  }

  private ensureZibalAmount(amount: number): void {
    if (amount < this.zibalMinAmountToman) {
      throw new BadRequestException(
        `Amount must be at least ${this.zibalMinAmountToman} TOMAN.`,
      );
    }
  }

  private toIrrAmount(amountToman: number): number {
    return amountToman * 10;
  }

  private getZibalCallbackUrl(): string {
    const cfg = this.config.get('zibal', { infer: true });
    if (!cfg?.callbackUrl) {
      throw new BadRequestException('Zibal callback URL is not configured.');
    }
    const globalPrefix = this.config.get<string>('GLOBAL_PREFIX') ?? '';
    const expectedPaths = this.buildCallbackPaths(globalPrefix);
    const parsed = this.parseUrl(cfg.callbackUrl, 'Zibal callback URL');
    const callbackPath = this.normalizePath(parsed.pathname);
    if (!expectedPaths.includes(callbackPath)) {
      throw new BadRequestException(
        `Zibal callback URL must be ${expectedPaths.join(' or ')} (current: ${callbackPath}).`,
      );
    }
    return parsed.toString();
  }

  private buildCallbackPaths(globalPrefix: string): string[] {
    const prefix = globalPrefix.trim();
    const base = prefix ? `/${prefix.replace(/^\/+|\/+$/g, '')}` : '';
    return [`${base}/payments/callback`, `${base}/payments/zibal/callback`];
  }

  private parseUrl(value: string, label: string): URL {
    try {
      return new URL(value);
    } catch {
      throw new BadRequestException(`${label} must be a valid URL.`);
    }
  }

  private normalizePath(pathname: string): string {
    const trimmed = pathname.replace(/\/+$/, '');
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
}
