import { Injectable, Logger } from '@nestjs/common';
import { EmailPort } from '../ports/email.port';

@Injectable()
export class FakeEmailAdapter implements EmailPort {
  private readonly logger = new Logger(FakeEmailAdapter.name);

  async send(to: string, subject: string, html: string): Promise<void> {
    this.logger.debug(
      `Sending email to=${to} subject=${subject} bodyLength=${html.length}`,
    );
  }
}
