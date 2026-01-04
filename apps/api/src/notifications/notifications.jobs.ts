import { NotificationTargetGroup } from '@prisma/client';

export interface DeliverToUserJob {
  notificationId: string;
  userId: string;
  dedupeKey?: string | null;
}

export interface DeliverToGroupJob {
  notificationId: string;
  group: NotificationTargetGroup;
  dedupeKeyPrefix?: string | null;
}

export interface DeliverToFollowersJob {
  notificationId: string;
  artistId: string;
  dedupeKeyPrefix?: string | null;
}
