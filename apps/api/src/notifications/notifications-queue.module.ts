import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { ConnectionOptions } from 'bullmq';
import { NOTIFICATIONS_QUEUE } from '@app/notifications/notifications.constants';
import { NotificationsProcessor } from '@app/notifications/notifications.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        const connection: ConnectionOptions = { url: redisUrl };
        return { connection };
      },
    }),
    BullModule.registerQueue({
      name: NOTIFICATIONS_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  providers: [NotificationsProcessor],
  exports: [BullModule],
})
export class NotificationsQueueModule {}
