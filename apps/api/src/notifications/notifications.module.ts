import { Module } from '@nestjs/common';
import { EMAIL_PORT, SMS_PORT } from '@app/notifications/notifications.constants';
import { FakeEmailAdapter } from '@app/notifications/adapters/fake-email.adapter';
import { FakeSmsAdapter } from '@app/notifications/adapters/fake-sms.adapter';
import { NotificationsQueueModule } from '@app/notifications/notifications-queue.module';
import { NotificationsService } from '@app/notifications/notifications.service';
import { NotificationsController } from '@app/notifications/notifications.controller';
import { AdminNotificationsController } from '@app/notifications/admin-notifications.controller';

@Module({
  imports: [NotificationsQueueModule],
  controllers: [NotificationsController, AdminNotificationsController],
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
    NotificationsService,
  ],
  exports: [SMS_PORT, EMAIL_PORT, NotificationsService],
})
export class NotificationsModule {}
