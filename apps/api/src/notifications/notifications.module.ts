import { Module } from '@nestjs/common';
import { EMAIL_PORT, SMS_PORT } from '@app/notifications/notifications.constants';
import { FakeEmailAdapter } from '@app/notifications/adapters/fake-email.adapter';
import { FakeSmsAdapter } from '@app/notifications/adapters/fake-sms.adapter';

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
