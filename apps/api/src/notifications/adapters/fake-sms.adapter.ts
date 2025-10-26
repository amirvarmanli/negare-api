import { Injectable, Logger } from '@nestjs/common';
import { SmsPort } from '../ports/sms.port';

@Injectable()
export class FakeSmsAdapter implements SmsPort {
  private readonly logger = new Logger(FakeSmsAdapter.name);

  async send(
    to: string,
    template: string,
    params: Record<string, string>,
  ): Promise<void> {
    this.logger.debug(
      `Sending SMS to=${to} template=${template} params=${JSON.stringify(
        params,
      )}`,
    );
  }
}
