import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpChannel } from '@prisma/client';
import { SmsService } from '@app/sms/sms.service';
import { MailService } from '@app/mail/mail.service';

export type OtpDeliveryResult = {
  provider: string;
  providerMessageId?: string;
};

export interface OtpDeliveryAdapter {
  sendSms(to: string, code: string): Promise<OtpDeliveryResult>;
  sendEmail(to: string, code: string): Promise<OtpDeliveryResult>;
}

@Injectable()
export class OtpDeliveryProvider implements OtpDeliveryAdapter {
  constructor(
    private readonly sms: SmsService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  providerName(channel: OtpChannel): string {
    return channel === OtpChannel.sms ? 'kavenegar' : 'smtp';
  }

  ensureConfigured(channel: OtpChannel): void {
    if (channel === OtpChannel.sms) {
      const apiKey = this.config.get<string>('KAVENEGAR_API_KEY');
      if (!apiKey) {
        throw new ServiceUnavailableException({
          success: false,
          error: {
            code: 'OTP_PROVIDER_NOT_CONFIGURED',
            message: 'SMS provider is not configured.',
          },
        });
      }
      return;
    }

    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    if (!host || !user || !pass) {
      throw new ServiceUnavailableException({
        success: false,
        error: {
          code: 'OTP_PROVIDER_NOT_CONFIGURED',
          message: 'Email provider is not configured.',
        },
      });
    }
  }

  async sendOtp(
    channel: OtpChannel,
    identifier: string,
    code: string,
  ): Promise<OtpDeliveryResult> {
    this.ensureConfigured(channel);
    const provider = this.providerName(channel);

    if (channel === OtpChannel.sms) {
      return this.sendSms(identifier, code);
    }

    return this.sendEmail(identifier, code);
  }

  async sendSms(to: string, code: string): Promise<OtpDeliveryResult> {
    const provider = this.providerName(OtpChannel.sms);
    const messageId = await this.sms.sendOtp(to, code);
    if (messageId) {
      return { provider, providerMessageId: messageId };
    }
    return { provider };
  }

  async sendEmail(to: string, code: string): Promise<OtpDeliveryResult> {
    const provider = this.providerName(OtpChannel.email);
    const messageId = await this.mail.sendOtp(to, code);
    if (messageId) {
      return { provider, providerMessageId: messageId };
    }
    return { provider };
  }
}
