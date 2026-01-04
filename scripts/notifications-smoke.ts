import { NestFactory } from '@nestjs/core';
import { NotificationType, NotificationStatus } from '@prisma/client';
import { AppModule } from '@app/app.module';
import { NotificationsService } from '@app/notifications/notifications.service';
import { PrismaService } from '@app/prisma/prisma.service';

async function run(): Promise<void> {
  const userId = process.env.NOTIFICATIONS_SMOKE_USER_ID;
  if (!userId) {
    // eslint-disable-next-line no-console
    console.error('NOTIFICATIONS_SMOKE_USER_ID is required');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const notifications = app.get(NotificationsService);
  const prisma = app.get(PrismaService);

  const notificationId = await notifications.createNotification({
    type: NotificationType.FOLLOWED_YOU,
    title: 'New notification',
    body: 'You have a new notification.',
    data: { actorId: 'smoke-user', actorName: 'Smoke User' },
  });

  await prisma.userNotification.create({
    data: {
      userId,
      notificationId,
      status: NotificationStatus.UNREAD,
      deliveredAt: new Date(),
    },
  });

  const before = await notifications.countUnread(userId);
  const inbox = await notifications.listInbox(userId, { page: 1, limit: 1 });
  if (inbox.items[0]) {
    await notifications.markRead(userId, inbox.items[0].id);
  }
  const after = await notifications.countUnread(userId);

  // eslint-disable-next-line no-console
  console.log({
    notificationId,
    unreadBefore: before,
    unreadAfter: after,
    inboxItem: inbox.items[0] ?? null,
  });

  await app.close();
}

run().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Smoke check failed:', error);
  process.exit(1);
});
