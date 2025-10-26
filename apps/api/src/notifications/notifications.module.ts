import { Module } from '@nestjs/common';
import { EMAIL_PORT, SMS_PORT } from './notifications.constants';
import { FakeEmailAdapter } from './adapters/fake-email.adapter';
import { FakeSmsAdapter } from './adapters/fake-sms.adapter';

@Module({
  providers: [
    FakeSmsAdapter,
    FakeEmailAdapter,
    {
      provide: SMS_PORT,
      useExisting: FakeSmsAdapter,
    },
    {
      provide: EMAIL_PORT,
      useExisting: FakeEmailAdapter,
    },
  ],
  exports: [SMS_PORT, EMAIL_PORT],
})
export class NotificationsModule {}
