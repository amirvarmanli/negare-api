import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  NotificationStatus,
  NotificationTargetGroup,
  NotificationType,
  Prisma,
} from '@prisma/client';
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
import { NotificationsMapper } from '@app/notifications/notifications.mapper';
import { buildPaginationMeta } from '@app/common/dto/pagination.dto';
import type { NotificationListQueryDto } from '@app/notifications/dtos/notification-query.dto';
import type {
  NotificationInboxResponseDto,
} from '@app/notifications/dtos/notification-inbox.dto';
import type {
  AdminBroadcastListDto,
  AdminBroadcastDeleteResponseDto,
} from '@app/notifications/dtos/admin-broadcast.dto';
import type { AdminBroadcastQueryDto } from '@app/notifications/dtos/admin-broadcast-query.dto';
import type {
  AdminNotificationsAllResponseDto,
} from '@app/notifications/dtos/admin-notifications-all.dto';
import type { AdminNotificationsAllQueryDto } from '@app/notifications/dtos/admin-notifications-all-query.dto';
import type {
  AdminNotificationsFeedResponseDto,
  AdminNotificationsFeedDeleteResponseDto,
} from '@app/notifications/dtos/admin-notifications-feed.dto';
import {
  AdminNotificationsFeedReadFilter,
  type AdminNotificationsFeedQueryDto,
} from '@app/notifications/dtos/admin-notifications-feed-query.dto';
import type {
  AdminNotificationsBroadcastRecipientsQueryDto,
} from '@app/notifications/dtos/admin-notifications-broadcast-recipients-query.dto';
import type {
  AdminNotificationsTimelineResponseDto,
} from '@app/notifications/dtos/admin-notifications-timeline.dto';
import {
  AdminNotificationsTimelineReadFilter,
  type AdminNotificationsTimelineQueryDto,
} from '@app/notifications/dtos/admin-notifications-timeline.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_TIMELINE_LIMIT = 50;

interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string | null;
  entityType?: string | null;
  entitySlug?: string | null;
  entityId?: string | null;
  href?: string | null;
  data?: Prisma.InputJsonValue | null;
  createdById?: string | null;
}

type NotificationData = Record<string, unknown>;
type JsonInput = Prisma.InputJsonValue;

type RichTextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'user'; text: string; userId: string; username?: string | null }
  | { kind: 'product'; text: string; productId: string; slug?: string | null };

type NotificationActor = {
  id: string;
  fullName: string;
  username: string | null;
  avatarUrl: string | null;
};

type NotificationProduct = {
  id: string;
  title: string;
  slug: string | null;
};

type NotificationAmount = {
  value: number;
  currency: 'IRR';
};

type NotificationContent = {
  title: string;
  body: string;
  data?: NotificationData | null;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
  ) {}

  async listInbox(
    userId: string,
    query: NotificationListQueryDto,
  ): Promise<NotificationInboxResponseDto> {
    const { page, limit, skip } = this.resolvePagination(
      query.page,
      query.limit,
      MAX_LIMIT,
    );
    const where: Prisma.UserNotificationWhereInput = {
      userId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.userNotification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          notification: {
            select: {
              type: true,
              title: true,
              body: true,
              actionUrl: true,
              entityType: true,
              entitySlug: true,
              entityId: true,
              href: true,
              data: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.userNotification.count({ where }),
    ]);

    return {
      items: items.map((item) => NotificationsMapper.toInboxItem(item)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.userNotification.count({
      where: {
        userId,
        status: NotificationStatus.UNREAD,
        deletedAt: null,
      },
    });
  }

  async markRead(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.userNotification.updateMany({
      where: {
        id,
        userId,
        deletedAt: null,
        status: { not: NotificationStatus.ARCHIVED },
      },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
    return result.count > 0;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.prisma.userNotification.updateMany({
      where: {
        userId,
        deletedAt: null,
        status: NotificationStatus.UNREAD,
      },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
    return result.count;
  }

  async archive(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.userNotification.updateMany({
      where: { id, userId, deletedAt: null },
      data: { status: NotificationStatus.ARCHIVED, readAt: new Date() },
    });
    return result.count > 0;
  }

  async createNotification(input: CreateNotificationInput): Promise<string> {
    const baseData = this.toRecordOrNull(input.data) ?? undefined;
    const content = this.buildEventNotificationContent(input.type, baseData);
    const mergedRecord = this.mergeRecord(baseData, content?.data ?? null);
    const mergedData = (mergedRecord ?? null) as JsonInput | null;
    const derivedActionUrl = this.buildActionUrl(input.type, mergedRecord ?? null);
    const actionUrl =
      input.actionUrl ?? (derivedActionUrl ? derivedActionUrl : null);
    const href = input.href ?? actionUrl ?? null;

    const created = await this.prisma.notification.create({
      data: {
        type: input.type,
        title: content?.title ?? input.title,
        body: content?.body ?? input.body,
        actionUrl,
        entityType: input.entityType ?? null,
        entitySlug: input.entitySlug ?? null,
        entityId: input.entityId ?? null,
        href,
        data: mergedData ?? null,
        createdById: input.createdById ?? null,
      },
      select: { id: true },
    });

    return created.id;
  }

  buildActionUrl(
    type: NotificationType,
    data?: NotificationData | null,
  ): string | null {
    if (type === NotificationType.WALLET_CREDITED) {
      return '/wallet';
    }

    const product = this.extractRecord(data?.product);
    const productSlug =
      this.extractString(product?.slug) ?? this.extractString(data?.productSlug);
    if (
      type === NotificationType.PURCHASED_YOUR_PRODUCT ||
      type === NotificationType.NEW_PRODUCT_FROM_FOLLOWED
    ) {
      return productSlug ? `/products/${productSlug}` : null;
    }

    if (type === NotificationType.FOLLOWED_YOU) {
      const actor = this.extractRecord(data?.actor);
      const actorId =
        this.extractString(actor?.id) ?? this.extractString(data?.actorId);
      return actorId ? `/users/${actorId}` : null;
    }

    return null;
  }

  async enqueueToUser(
    notificationId: string,
    userId: string,
    dedupeKey?: string | null,
  ): Promise<void> {
    const payload: DeliverToUserJob = { notificationId, userId, dedupeKey };
    await this.queue.add(NOTIFICATIONS_JOB_DELIVER_TO_USER, payload);
  }

  async enqueueToGroup(
    notificationId: string,
    group: NotificationTargetGroup,
    dedupeKeyPrefix?: string | null,
  ): Promise<void> {
    const payload: DeliverToGroupJob = {
      notificationId,
      group,
      dedupeKeyPrefix: dedupeKeyPrefix ?? null,
    };
    await this.queue.add(NOTIFICATIONS_JOB_DELIVER_TO_GROUP, payload);
  }

  async enqueueToFollowers(
    notificationId: string,
    artistId: string,
    dedupeKeyPrefix?: string | null,
  ): Promise<void> {
    const payload: DeliverToFollowersJob = {
      notificationId,
      artistId,
      dedupeKeyPrefix: dedupeKeyPrefix ?? null,
    };
    await this.queue.add(NOTIFICATIONS_JOB_DELIVER_TO_FOLLOWERS, payload);
  }

  async listBroadcasts(
    query: AdminBroadcastQueryDto,
  ): Promise<AdminBroadcastListDto> {
    const { page, limit, skip } = this.resolvePagination(
      query.page,
      query.limit,
      MAX_LIMIT,
    );
    const where: Prisma.NotificationWhereInput = {
      type: NotificationType.ADMIN_BROADCAST,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              username: true,
              avatarUrl: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items: items.map((item) => {
        const sender = item.createdBy;
        return {
          id: item.id,
          type: item.type,
          message: item.body,
          sentAt: item.createdAt.toISOString(),
          sender: {
            id: sender?.id ?? 'unknown',
            fullName: this.resolveFullName(sender),
            avatarUrl: sender?.avatarUrl ?? null,
            email: sender?.email ?? null,
            phone: sender?.phone ?? null,
          },
        };
      }),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async listAll(
    query: AdminNotificationsAllQueryDto,
  ): Promise<AdminNotificationsAllResponseDto> {
    const { page, limit, skip } = this.resolvePagination(
      query.page,
      query.limit,
      MAX_LIMIT,
    );
    const where: Prisma.NotificationWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.createdById ? { createdById: query.createdById } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { body: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: query.sortDir ?? 'desc' },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items: items.map((item) => {
        const data = this.toRecordOrNull(item.data);
        return {
          id: item.id,
          type: item.type,
          title: item.title,
          body: item.body,
          actionUrl: item.actionUrl,
          targetGroup: this.extractTargetGroup(data),
          createdById: item.createdById ?? null,
          createdByName: item.createdBy?.name ?? null,
          createdByUsername: item.createdBy?.username ?? null,
          createdAt: item.createdAt.toISOString(),
          data,
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async listAdminFeed(
    query: AdminNotificationsFeedQueryDto,
  ): Promise<AdminNotificationsFeedResponseDto> {
    const { page, limit, skip } = this.resolvePagination(
      query.page,
      query.limit,
      MAX_LIMIT,
    );
    if (query.type === NotificationType.ADMIN_BROADCAST) {
      return { items: [], meta: { page, limit, total: 0, totalPages: 0 } };
    }
    const notificationWhere: Prisma.NotificationWhereInput = query.type
      ? { type: query.type }
      : { type: { not: NotificationType.ADMIN_BROADCAST } };
    const where: Prisma.UserNotificationWhereInput = {
      ...(query.recipientId ? { userId: query.recipientId } : {}),
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.read === AdminNotificationsFeedReadFilter.read
        ? { status: NotificationStatus.READ }
        : {}),
      ...(query.read === AdminNotificationsFeedReadFilter.unread
        ? { status: NotificationStatus.UNREAD }
        : {}),
      notification: notificationWhere,
      ...(query.q
        ? {
            OR: [
              { notification: { title: { contains: query.q, mode: 'insensitive' } } },
              { notification: { body: { contains: query.q, mode: 'insensitive' } } },
              { user: { name: { contains: query.q, mode: 'insensitive' } } },
              { user: { username: { contains: query.q, mode: 'insensitive' } } },
              { user: { email: { contains: query.q, mode: 'insensitive' } } },
              { user: { phone: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.userNotification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          notification: {
            select: {
              type: true,
              body: true,
              entityType: true,
              entitySlug: true,
              href: true,
              actionUrl: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              username: true,
              avatarUrl: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.userNotification.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        message: item.notification.body,
        type: item.notification.type,
        sentAt: (item.deliveredAt ?? item.createdAt).toISOString(),
        readAt: item.readAt ? item.readAt.toISOString() : null,
        link: {
          entityType: item.notification.entityType ?? null,
          entitySlug: item.notification.entitySlug ?? null,
          href: item.notification.href ?? item.notification.actionUrl ?? null,
        },
        recipient: {
          id: item.user.id,
          fullName: this.resolveFullName(item.user),
          avatarUrl: item.user.avatarUrl ?? null,
          email: item.user.email ?? null,
          phone: item.user.phone ?? null,
        },
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async listBroadcastRecipients(
    notificationId: string,
    query: AdminNotificationsBroadcastRecipientsQueryDto,
  ): Promise<AdminNotificationsFeedResponseDto> {
    const { page, limit, skip } = this.resolvePagination(
      query.page,
      query.limit,
      MAX_LIMIT,
    );
    const where: Prisma.UserNotificationWhereInput = {
      notificationId,
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.read === AdminNotificationsFeedReadFilter.read
        ? { status: NotificationStatus.READ }
        : {}),
      ...(query.read === AdminNotificationsFeedReadFilter.unread
        ? { status: NotificationStatus.UNREAD }
        : {}),
      ...(query.q
        ? {
            OR: [
              { notification: { title: { contains: query.q, mode: 'insensitive' } } },
              { notification: { body: { contains: query.q, mode: 'insensitive' } } },
              { user: { name: { contains: query.q, mode: 'insensitive' } } },
              { user: { username: { contains: query.q, mode: 'insensitive' } } },
              { user: { email: { contains: query.q, mode: 'insensitive' } } },
              { user: { phone: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.userNotification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          notification: {
            select: {
              type: true,
              body: true,
              entityType: true,
              entitySlug: true,
              href: true,
              actionUrl: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              username: true,
              avatarUrl: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.userNotification.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        message: item.notification.body,
        type: item.notification.type,
        sentAt: (item.deliveredAt ?? item.createdAt).toISOString(),
        readAt: item.readAt ? item.readAt.toISOString() : null,
        link: {
          entityType: item.notification.entityType ?? null,
          entitySlug: item.notification.entitySlug ?? null,
          href: item.notification.href ?? item.notification.actionUrl ?? null,
        },
        recipient: {
          id: item.user.id,
          fullName: this.resolveFullName(item.user),
          avatarUrl: item.user.avatarUrl ?? null,
          email: item.user.email ?? null,
          phone: item.user.phone ?? null,
        },
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async deleteBroadcast(
    notificationId: string,
  ): Promise<AdminBroadcastDeleteResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      await tx.userNotification.deleteMany({ where: { notificationId } });
      await tx.notification.delete({ where: { id: notificationId } });
    });
    return { success: true };
  }

  async deleteAdminFeedRecipient(
    recipientRowId: string,
  ): Promise<AdminNotificationsFeedDeleteResponseDto> {
    await this.prisma.userNotification.updateMany({
      where: { id: recipientRowId },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  async listTimeline(
    query: AdminNotificationsTimelineQueryDto,
  ): Promise<AdminNotificationsTimelineResponseDto> {
    const { page, limit, skip } = this.resolvePagination(
      query.page,
      query.limit,
      MAX_TIMELINE_LIMIT,
    );
    const readFilter = query.read ?? AdminNotificationsTimelineReadFilter.all;
    const q = query.q?.trim();

    const includeBroadcasts =
      !query.type || query.type === NotificationType.ADMIN_BROADCAST;
    const includeEvents =
      !query.type || query.type !== NotificationType.ADMIN_BROADCAST;

    const broadcastConditions: Prisma.Sql[] = [];
    const eventConditions: Prisma.Sql[] = [];

    if (includeBroadcasts) {
      broadcastConditions.push(
        Prisma.sql`n."type" = 'ADMIN_BROADCAST'::core.notification_type_enum`,
      );
      if (q && q.length > 0) {
        const like = `%${q}%`;
        broadcastConditions.push(Prisma.sql`(
          n."title" ILIKE ${like}
          OR n."body" ILIKE ${like}
          OR sender."name" ILIKE ${like}
          OR sender."username" ILIKE ${like}
          OR sender."email" ILIKE ${like}
          OR sender."phone" ILIKE ${like}
        )`);
      }
    }

    if (includeEvents) {
      eventConditions.push(Prisma.sql`un."deletedAt" IS NULL`);
      if (query.type && query.type !== NotificationType.ADMIN_BROADCAST) {
        eventConditions.push(
          Prisma.sql`n."type" = ${query.type}::core.notification_type_enum`,
        );
      } else {
        eventConditions.push(
          Prisma.sql`n."type" <> 'ADMIN_BROADCAST'::core.notification_type_enum`,
        );
      }
      if (readFilter === AdminNotificationsTimelineReadFilter.read) {
        eventConditions.push(
          Prisma.sql`un."status" = 'READ'::core.notification_status_enum`,
        );
      }
      if (readFilter === AdminNotificationsTimelineReadFilter.unread) {
        eventConditions.push(
          Prisma.sql`un."status" = 'UNREAD'::core.notification_status_enum`,
        );
      }
      if (q && q.length > 0) {
        const like = `%${q}%`;
        eventConditions.push(Prisma.sql`(
          n."title" ILIKE ${like}
          OR n."body" ILIKE ${like}
          OR recipient."name" ILIKE ${like}
          OR recipient."username" ILIKE ${like}
          OR recipient."email" ILIKE ${like}
          OR recipient."phone" ILIKE ${like}
        )`);
      }
    }

    const broadcastWhere = broadcastConditions.length
      ? Prisma.sql`WHERE ${Prisma.join(broadcastConditions, ' AND ')}`
      : Prisma.sql``;
    const eventWhere = eventConditions.length
      ? Prisma.sql`WHERE ${Prisma.join(eventConditions, ' AND ')}`
      : Prisma.sql``;

    const broadcastQuery = includeBroadcasts
      ? Prisma.sql`
          SELECT
            'broadcast'::text AS kind,
            n."id"::text AS id,
            n."type"::text AS type,
            n."body"::text AS message,
            n."createdAt" AS "sentAt",
            NULL::timestamptz AS "readAt",
            sender."id"::text AS sender_id,
            sender."name"::text AS sender_name,
            sender."firstName"::text AS sender_first_name,
            sender."lastName"::text AS sender_last_name,
            sender."username"::text AS sender_username,
            sender."avatarUrl"::text AS sender_avatar_url,
            sender."email"::text AS sender_email,
            sender."phone"::text AS sender_phone,
            NULL::text AS recipient_id,
            NULL::text AS recipient_name,
            NULL::text AS recipient_first_name,
            NULL::text AS recipient_last_name,
            NULL::text AS recipient_username,
            NULL::text AS recipient_avatar_url,
            NULL::text AS recipient_email,
            NULL::text AS recipient_phone,
            n."entityType"::text AS entity_type,
            n."entitySlug"::text AS entity_slug,
            COALESCE(n."href", n."actionUrl")::text AS href
          FROM "core"."notifications" n
          LEFT JOIN "core"."users" sender ON sender."id" = n."createdById"
          ${broadcastWhere}
        `
      : Prisma.sql``;

    const eventQuery = includeEvents
      ? Prisma.sql`
          SELECT
            'event'::text AS kind,
            un."id"::text AS id,
            n."type"::text AS type,
            n."body"::text AS message,
            COALESCE(un."deliveredAt", un."createdAt") AS "sentAt",
            un."readAt" AS "readAt",
            NULL::text AS sender_id,
            NULL::text AS sender_name,
            NULL::text AS sender_first_name,
            NULL::text AS sender_last_name,
            NULL::text AS sender_username,
            NULL::text AS sender_avatar_url,
            NULL::text AS sender_email,
            NULL::text AS sender_phone,
            recipient."id"::text AS recipient_id,
            recipient."name"::text AS recipient_name,
            recipient."firstName"::text AS recipient_first_name,
            recipient."lastName"::text AS recipient_last_name,
            recipient."username"::text AS recipient_username,
            recipient."avatarUrl"::text AS recipient_avatar_url,
            recipient."email"::text AS recipient_email,
            recipient."phone"::text AS recipient_phone,
            n."entityType"::text AS entity_type,
            n."entitySlug"::text AS entity_slug,
            COALESCE(n."href", n."actionUrl")::text AS href
          FROM "core"."user_notifications" un
          INNER JOIN "core"."notifications" n ON n."id" = un."notificationId"
          INNER JOIN "core"."users" recipient ON recipient."id" = un."userId"
          ${eventWhere}
        `
      : Prisma.sql``;

    const unionQuery = this.composeUnion(broadcastQuery, eventQuery);

    type TimelineRow = {
      kind: 'broadcast' | 'event';
      id: string;
      type: NotificationType;
      message: string;
      sentAt: Date;
      readAt: Date | null;
      sender_id: string | null;
      sender_name: string | null;
      sender_first_name: string | null;
      sender_last_name: string | null;
      sender_username: string | null;
      sender_avatar_url: string | null;
      sender_email: string | null;
      sender_phone: string | null;
      recipient_id: string | null;
      recipient_name: string | null;
      recipient_first_name: string | null;
      recipient_last_name: string | null;
      recipient_username: string | null;
      recipient_avatar_url: string | null;
      recipient_email: string | null;
      recipient_phone: string | null;
      entity_type: string | null;
      entity_slug: string | null;
      href: string | null;
    };

    const [rows, countRows] = await this.prisma.$transaction([
      this.prisma.$queryRaw<TimelineRow[]>(
        Prisma.sql`
          SELECT * FROM (${unionQuery}) AS timeline
          ORDER BY "sentAt" DESC
          LIMIT ${limit} OFFSET ${skip}
        `,
      ),
      this.prisma.$queryRaw<Array<{ total: bigint }>>(
        Prisma.sql`
          SELECT COUNT(*)::bigint AS total FROM (${unionQuery}) AS timeline
        `,
      ),
    ]);

    const total = Number(countRows[0]?.total ?? 0n);

    return {
      items: rows.map((row) => ({
        kind: row.kind,
        id: row.id,
        type: row.type,
        message: row.message,
        sentAt: row.sentAt.toISOString(),
        readAt: row.readAt ? row.readAt.toISOString() : null,
        sender: row.sender_id
          ? {
              id: row.sender_id,
              fullName: this.resolveFullName({
                name: row.sender_name,
                firstName: row.sender_first_name,
                lastName: row.sender_last_name,
                username: row.sender_username,
                email: row.sender_email,
                phone: row.sender_phone,
              }),
              avatarUrl: row.sender_avatar_url,
              email: row.sender_email,
              phone: row.sender_phone,
            }
          : undefined,
        recipient: row.recipient_id
          ? {
              id: row.recipient_id,
              fullName: this.resolveFullName({
                name: row.recipient_name,
                firstName: row.recipient_first_name,
                lastName: row.recipient_last_name,
                username: row.recipient_username,
                email: row.recipient_email,
                phone: row.recipient_phone,
              }),
              avatarUrl: row.recipient_avatar_url,
              email: row.recipient_email,
              phone: row.recipient_phone,
            }
          : undefined,
        link:
          row.entity_type || row.entity_slug || row.href
            ? {
                entityType: row.entity_type,
                entitySlug: row.entity_slug,
                href: row.href,
              }
            : undefined,
      })),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  private resolvePagination(
    page?: number,
    limit?: number,
    maxLimit = MAX_LIMIT,
  ): { page: number; limit: number; skip: number } {
    const safePage = page && page > 0 ? page : DEFAULT_PAGE;
    const safeLimit = limit && limit > 0 ? Math.min(limit, maxLimit) : DEFAULT_LIMIT;
    return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
  }

  private buildEventNotificationContent(
    type: NotificationType,
    data?: NotificationData,
  ): NotificationContent | null {
    if (type === NotificationType.ADMIN_BROADCAST) {
      return null;
    }

    if (type === NotificationType.FOLLOWED_YOU) {
      const actor = this.resolveActor(data, 'کاربر');
      const actorName = this.resolveActorDisplayName(data, 'کاربر');
      const segments = this.buildFollowedSegments(actorName, actor);
      return {
        title: 'فالو جدید',
        body: `${actorName} شما را دنبال کرد.`,
        data: {
          ...(actor ? { actor } : {}),
          richText: segments,
        },
      };
    }

    if (type === NotificationType.PURCHASED_YOUR_PRODUCT) {
      const actor = this.resolveActor(data, 'کاربر');
      const product = this.resolveProduct(data, 'محصول');
      const actorName = this.resolveActorDisplayName(data, 'کاربر');
      const productTitle = this.resolveProductTitle(data, 'محصول');
      const segments = this.buildPurchaseSegments(actorName, productTitle, actor, product);
      return {
        title: 'خرید محصول',
        body: `${actorName} محصول «${productTitle}» شما را خرید.`,
        data: {
          ...(actor ? { actor } : {}),
          ...(product ? { product } : {}),
          richText: segments,
        },
      };
    }

    if (type === NotificationType.WALLET_CREDITED) {
      const amount = this.resolveAmount(data);
      const product = this.resolveProduct(data);
      const amountText = amount?.value
        ? amount.value.toLocaleString('fa-IR')
        : 'نامشخص';
      const productTitle = this.resolveProductTitle(data);
      const segments = this.buildWalletCreditedSegments(
        amountText,
        productTitle,
        product,
      );
      const body = productTitle
        ? `مبلغ ${amountText} تومان به کیف پول شما بابت فروش محصول «${productTitle}» اضافه شد.`
        : `مبلغ ${amountText} تومان به کیف پول شما اضافه شد.`;
      return {
        title: 'شارژ کیف پول',
        body,
        data: {
          ...(amount ? { amount } : {}),
          ...(product ? { product } : {}),
          richText: segments,
        },
      };
    }

    if (type === NotificationType.NEW_PRODUCT_FROM_FOLLOWED) {
      const actor = this.resolveActor(data, 'هنرمند');
      const product = this.resolveProduct(data, 'محصول');
      const artistName = this.resolveActorDisplayName(data, 'هنرمند');
      const productTitle = this.resolveProductTitle(data, 'محصول');
      const segments = this.buildNewProductSegments(artistName, productTitle, actor, product);
      return {
        title: 'محصول جدید',
        body: `${artistName} محصول «${productTitle}» را منتشر کرد.`,
        data: {
          ...(actor ? { actor } : {}),
          ...(product ? { product } : {}),
          richText: segments,
        },
      };
    }

    return null;
  }

  private mergeRecord(
    base: NotificationData | null | undefined,
    extra: NotificationData | null | undefined,
  ): NotificationData | null {
    if (!base && !extra) {
      return null;
    }
    return { ...(base ?? {}), ...(extra ?? {}) };
  }

  private resolveFullName(user?: {
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null): string {
    if (!user) {
      return 'User';
    }
    const name = user.name?.trim();
    if (name) {
      return name;
    }
    const combined = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    if (combined) {
      return combined;
    }
    return (
      user.username ?? user.email ?? user.phone ?? 'User'
    ).toString();
  }

  private toRecordOrNull(
    value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined,
  ): NotificationData | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as NotificationData;
  }

  private extractRecord(
    value: unknown,
  ): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private resolveActor(
    data: NotificationData | undefined,
    fallbackName: string,
  ): NotificationActor | null {
    const actor = this.extractRecord(data?.actor);
    const id =
      this.extractString(actor?.id) ??
      this.extractString(data?.actorId) ??
      this.extractString(data?.artistId);
    const fullName =
      this.extractString(actor?.fullName) ??
      this.extractString(actor?.name) ??
      this.extractString(data?.actorName) ??
      this.extractString(data?.artistName) ??
      fallbackName;
    const username =
      this.extractString(actor?.username) ??
      this.extractString(data?.actorUsername) ??
      this.extractString(data?.artistUsername) ??
      null;
    const avatarUrl =
      this.extractString(actor?.avatarUrl) ??
      this.extractString(data?.actorAvatarUrl) ??
      this.extractString(data?.artistAvatarUrl) ??
      null;
    if (!id && !fullName) {
      return null;
    }
    if (!id) {
      return null;
    }
    return {
      id,
      fullName,
      username,
      avatarUrl,
    };
  }

  private resolveActorDisplayName(
    data: NotificationData | undefined,
    fallbackName: string,
  ): string {
    const actor = this.extractRecord(data?.actor);
    return (
      this.extractString(actor?.fullName) ??
      this.extractString(actor?.name) ??
      this.extractString(data?.actorName) ??
      this.extractString(data?.artistName) ??
      fallbackName
    );
  }

  private resolveProduct(
    data: NotificationData | undefined,
    fallbackTitle?: string,
  ): NotificationProduct | null {
    const product = this.extractRecord(data?.product);
    const id =
      this.extractString(product?.id) ?? this.extractString(data?.productId);
    const title =
      this.extractString(product?.title) ??
      this.extractString(data?.productTitle) ??
      fallbackTitle;
    const slug =
      this.extractString(product?.slug) ?? this.extractString(data?.productSlug);
    if (!id && !title) {
      return null;
    }
    if (!id) {
      return null;
    }
    return {
      id,
      title: title ?? 'محصول',
      slug: slug ?? null,
    };
  }

  private resolveProductTitle(
    data: NotificationData | undefined,
    fallbackTitle?: string,
  ): string | undefined {
    const product = this.extractRecord(data?.product);
    return (
      this.extractString(product?.title) ??
      this.extractString(data?.productTitle) ??
      fallbackTitle
    );
  }

  private resolveAmount(
    data: NotificationData | undefined,
  ): NotificationAmount | null {
    const amountRecord = this.extractRecord(data?.amount);
    const valueFromRecord = amountRecord?.value;
    const value =
      typeof valueFromRecord === 'number'
        ? valueFromRecord
        : typeof data?.amount === 'number'
          ? data.amount
          : undefined;
    if (value === undefined) {
      return null;
    }
    return { value, currency: 'IRR' };
  }

  private buildFollowedSegments(
    actorName: string,
    actor: NotificationActor | null,
  ): RichTextSegment[] {
    if (actor?.id) {
      return [
        { kind: 'user', text: actorName, userId: actor.id, username: actor.username },
        { kind: 'text', text: ' شما را دنبال کرد.' },
      ];
    }
    return [
      { kind: 'text', text: `${actorName} شما را دنبال کرد.` },
    ];
  }

  private buildPurchaseSegments(
    actorName: string,
    productTitle: string,
    actor: NotificationActor | null,
    product: NotificationProduct | null,
  ): RichTextSegment[] {
    const segments: RichTextSegment[] = [];
    if (actor?.id) {
      segments.push({
        kind: 'user',
        text: actorName,
        userId: actor.id,
        username: actor.username,
      });
    } else {
      segments.push({ kind: 'text', text: actorName });
    }
    segments.push({ kind: 'text', text: ' محصول «' });
    if (product?.id) {
      segments.push({
        kind: 'product',
        text: productTitle,
        productId: product.id,
        slug: product.slug ?? null,
      });
    } else {
      segments.push({ kind: 'text', text: productTitle });
    }
    segments.push({ kind: 'text', text: '» شما را خرید.' });
    return segments;
  }

  private buildWalletCreditedSegments(
    amountText: string,
    productTitle: string | undefined,
    product: NotificationProduct | null,
  ): RichTextSegment[] {
    if (product?.id) {
      return [
        { kind: 'text', text: `مبلغ ${amountText} تومان به کیف پول شما بابت فروش محصول «` },
        {
          kind: 'product',
          text: product.title,
          productId: product.id,
          slug: product.slug ?? null,
        },
        { kind: 'text', text: '» اضافه شد.' },
      ];
    }
    if (productTitle) {
      return [
        { kind: 'text', text: `مبلغ ${amountText} تومان به کیف پول شما بابت فروش محصول «${productTitle}» اضافه شد.` },
      ];
    }
    return [
      { kind: 'text', text: `مبلغ ${amountText} تومان به کیف پول شما اضافه شد.` },
    ];
  }

  private buildNewProductSegments(
    artistName: string,
    productTitle: string,
    actor: NotificationActor | null,
    product: NotificationProduct | null,
  ): RichTextSegment[] {
    const segments: RichTextSegment[] = [];
    if (actor?.id) {
      segments.push({
        kind: 'user',
        text: artistName,
        userId: actor.id,
        username: actor.username,
      });
    } else {
      segments.push({ kind: 'text', text: artistName });
    }
    segments.push({ kind: 'text', text: ' محصول «' });
    if (product?.id) {
      segments.push({
        kind: 'product',
        text: productTitle,
        productId: product.id,
        slug: product.slug ?? null,
      });
    } else {
      segments.push({ kind: 'text', text: productTitle });
    }
    segments.push({ kind: 'text', text: '» را منتشر کرد.' });
    return segments;
  }

  private extractTargetGroup(
    data: NotificationData | null,
  ): NotificationTargetGroup | null {
    const targetGroup = data?.targetGroup;
    if (typeof targetGroup !== 'string') {
      return null;
    }
    const values = Object.values(NotificationTargetGroup);
    return values.includes(targetGroup as NotificationTargetGroup)
      ? (targetGroup as NotificationTargetGroup)
      : null;
  }

  private extractString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0
      ? value
      : null;
  }

  private composeUnion(
    broadcastQuery: Prisma.Sql,
    eventQuery: Prisma.Sql,
  ): Prisma.Sql {
    if (broadcastQuery.sql.length === 0) {
      return eventQuery;
    }
    if (eventQuery.sql.length === 0) {
      return broadcastQuery;
    }
    return Prisma.sql`${broadcastQuery} UNION ALL ${eventQuery}`;
  }
}

// Manual smoke tests:
// - Broadcast create/list/delete
// - User inbox list/unread/read
// - Admin feed list/delete
// - Timeline list (if enabled)
