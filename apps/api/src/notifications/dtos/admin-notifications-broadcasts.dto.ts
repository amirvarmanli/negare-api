import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationTargetGroup, NotificationType } from '@prisma/client';

export class AdminNotificationsBroadcastStatsDto {
  @ApiProperty({ example: 120 })
  delivered!: number;

  @ApiProperty({ example: 80 })
  read!: number;

  @ApiProperty({ example: 30 })
  unread!: number;

  @ApiProperty({ example: 10 })
  archived!: number;

  @ApiProperty({ example: 0 })
  deleted!: number;
}

export class AdminNotificationsBroadcastItemDto {
  @ApiProperty({ example: 'notification-uuid' })
  id!: string;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiPropertyOptional({ enum: NotificationTargetGroup })
  targetGroup?: NotificationTargetGroup | null;

  @ApiProperty({ example: 'Broadcast title' })
  title!: string;

  @ApiProperty({ example: 'Broadcast message body' })
  message!: string;

  @ApiProperty({ example: '2025-01-01T10:00:00.000Z' })
  sentAt!: string;

  @ApiProperty({ type: AdminNotificationsBroadcastStatsDto })
  stats!: AdminNotificationsBroadcastStatsDto;
}

export class AdminNotificationsBroadcastsMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

export class AdminNotificationsBroadcastsResponseDto {
  @ApiProperty({ type: [AdminNotificationsBroadcastItemDto] })
  items!: AdminNotificationsBroadcastItemDto[];

  @ApiProperty({ type: AdminNotificationsBroadcastsMetaDto })
  meta!: AdminNotificationsBroadcastsMetaDto;
}
