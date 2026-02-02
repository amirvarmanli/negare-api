import { NotificationTargetGroup } from '@prisma/client';

export interface DeliverToUserJobMetadata {
  traceId?: string;
  walletTxId?: string;
  walletUserId?: string;
  reason?: string;
  amount?: number;
}

export interface DeliverToUserJob {
  notificationId: string;
  userId: string;
  dedupeKey?: string | null;
  metadata?: DeliverToUserJobMetadata | null;
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
