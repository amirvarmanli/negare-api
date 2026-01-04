import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { NotificationStatus, NotificationTargetGroup, Prisma, RoleName, UserStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '@app/prisma/prisma.service';
import {
  NOTIFICATIONS_JOB_DELIVER_TO_FOLLOWERS,
  NOTIFICATIONS_JOB_DELIVER_TO_GROUP,
  NOTIFICATIONS_JOB_DELIVER_TO_USER,
  NOTIFICATIONS_QUEUE,
} from '@app/notifications/notifications.constants';
import type {
  DeliverToFollowersJob,
  DeliverToGroupJob,
  DeliverToUserJob,
} from '@app/notifications/notifications.jobs';

const CHUNK_SIZE = 500;

@Injectable()
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(
    job: Job<DeliverToUserJob | DeliverToGroupJob | DeliverToFollowersJob>,
  ): Promise<void> {
    if (job.name === NOTIFICATIONS_JOB_DELIVER_TO_USER) {
      await this.handleDeliverToUser(job as Job<DeliverToUserJob>);
      return;
    }
    if (job.name === NOTIFICATIONS_JOB_DELIVER_TO_GROUP) {
      await this.handleDeliverToGroup(job as Job<DeliverToGroupJob>);
      return;
    }
    if (job.name === NOTIFICATIONS_JOB_DELIVER_TO_FOLLOWERS) {
      await this.handleDeliverToFollowers(job as Job<DeliverToFollowersJob>);
    }
  }

  private async handleDeliverToUser(
    job: Job<DeliverToUserJob>,
  ): Promise<void> {
    const { notificationId, userId, dedupeKey } = job.data;
    try {
      await this.prisma.userNotification.create({
        data: {
          userId,
          notificationId,
          dedupeKey: dedupeKey ?? null,
          deliveredAt: new Date(),
          status: NotificationStatus.UNREAD,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return;
      }
      this.logger.error(
        `deliver_to_user failed: notificationId=${notificationId} userId=${userId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private async handleDeliverToGroup(
    job: Job<DeliverToGroupJob>,
  ): Promise<void> {
    const { notificationId, group, dedupeKeyPrefix } = job.data;
    let lastId: string | null = null;
    for (;;) {
      const rows = await this.prisma.user.findMany({
        select: { id: true },
        where: this.buildGroupWhere(group),
        orderBy: { id: 'asc' },
        take: CHUNK_SIZE,
        ...(lastId
          ? { cursor: { id: lastId }, skip: 1 }
          : {}),
      });
      if (rows.length === 0) {
        return;
      }
      const userIds = rows.map((row) => row.id);
      await this.createUserNotifications(
        userIds,
        notificationId,
        dedupeKeyPrefix ?? null,
      );
      lastId = rows[rows.length - 1].id;
    }
  }

  private async handleDeliverToFollowers(
    job: Job<DeliverToFollowersJob>,
  ): Promise<void> {
    const { notificationId, artistId, dedupeKeyPrefix } = job.data;
    let lastFollowerId: string | null = null;
    for (;;) {
      const rows = await this.prisma.artistFollow.findMany({
        select: { followerId: true },
        where: { artistId },
        orderBy: { followerId: 'asc' },
        take: CHUNK_SIZE,
        ...(lastFollowerId
          ? {
              cursor: {
                followerId_artistId: {
                  followerId: lastFollowerId,
                  artistId,
                },
              },
              skip: 1,
            }
          : {}),
      });
      if (rows.length === 0) {
        return;
      }
      const followerIds = rows.map((row) => row.followerId);
      await this.createUserNotifications(
        followerIds,
        notificationId,
        dedupeKeyPrefix ?? null,
      );
      lastFollowerId = rows[rows.length - 1].followerId;
    }
  }

  private async createUserNotifications(
    userIds: string[],
    notificationId: string,
    dedupeKeyPrefix: string | null,
  ): Promise<void> {
    if (userIds.length === 0) return;
    const now = new Date();
    const data: Prisma.UserNotificationCreateManyInput[] = userIds.map(
      (userId) => ({
        userId,
        notificationId,
        dedupeKey: dedupeKeyPrefix ? `${dedupeKeyPrefix}${userId}` : null,
        deliveredAt: now,
        status: NotificationStatus.UNREAD,
      }),
    );
    await this.prisma.userNotification.createMany({
      data,
      skipDuplicates: true,
    });
  }

  private buildGroupWhere(group: DeliverToGroupJob['group']) {
    if (group === NotificationTargetGroup.SUPPLIERS_ONLY) {
      return { role: RoleName.supplier, status: UserStatus.active };
    }
    if (group === NotificationTargetGroup.USERS_ONLY) {
      return { role: RoleName.user, status: UserStatus.active };
    }
    return { status: UserStatus.active };
  }
}
