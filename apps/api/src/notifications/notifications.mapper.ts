import { NotificationStatus, NotificationType, Prisma } from '@prisma/client';
import { NotificationInboxItemDto } from '@app/notifications/dtos/notification-inbox.dto';

type NotificationJoin = {
  id: string;
  status: NotificationStatus;
  readAt: Date | null;
  createdAt: Date;
  deliveredAt: Date | null;
  notification: {
    type: NotificationType;
    title: string;
    body: string;
    actionUrl: string | null;
    entityType: string | null;
    entitySlug: string | null;
    entityId: string | null;
    href: string | null;
    data: Prisma.JsonValue | null;
    createdAt: Date;
  };
};

function toRecordOrNull(
  value: Prisma.JsonValue | null | undefined,
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export class NotificationsMapper {
  static toInboxItem(entity: NotificationJoin): NotificationInboxItemDto {
    return {
      id: entity.id,
      type: entity.notification.type,
      title: entity.notification.title,
      body: entity.notification.body,
      actionUrl: entity.notification.actionUrl,
      link:
        entity.notification.entityType ||
        entity.notification.entitySlug ||
        entity.notification.entityId ||
        entity.notification.href ||
        entity.notification.actionUrl
          ? {
              entityType: entity.notification.entityType,
              entitySlug: entity.notification.entitySlug,
              entityId: entity.notification.entityId,
              href:
                entity.notification.href ??
                entity.notification.actionUrl ??
                null,
            }
          : undefined,
      data: toRecordOrNull(entity.notification.data),
      status: entity.status,
      createdAt: entity.createdAt.toISOString(),
      notificationCreatedAt: entity.notification.createdAt.toISOString(),
      deliveredAt: entity.deliveredAt ? entity.deliveredAt.toISOString() : null,
      readAt: entity.readAt ? entity.readAt.toISOString() : null,
    };
  }
}
