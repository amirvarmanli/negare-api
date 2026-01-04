import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationType } from '@prisma/client';
import { PaginationMetaDto } from '@app/common/dto/pagination.dto';

export enum AdminNotificationsTimelineReadFilter {
  all = 'all',
  read = 'read',
  unread = 'unread',
}

export class AdminNotificationsTimelineQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ description: 'Search message and sender/recipient identity.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({
    enum: AdminNotificationsTimelineReadFilter,
    default: AdminNotificationsTimelineReadFilter.all,
    description: 'Applies only to event notifications.',
  })
  @IsOptional()
  @IsEnum(AdminNotificationsTimelineReadFilter)
  read?: AdminNotificationsTimelineReadFilter;

  @ApiPropertyOptional({ enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}

export class AdminNotificationsTimelineSenderDto {
  @ApiProperty({ example: 'admin-uuid' })
  id!: string;

  @ApiProperty({ example: 'Negare Admin' })
  fullName!: string;

  @ApiPropertyOptional({ example: 'https://cdn.negare.test/avatar.png' })
  avatarUrl?: string | null;

  @ApiPropertyOptional({ example: 'admin@negare.test' })
  email?: string | null;

  @ApiPropertyOptional({ example: '+989121234567' })
  phone?: string | null;
}

export class AdminNotificationsTimelineRecipientDto {
  @ApiProperty({ example: 'user-uuid' })
  id!: string;

  @ApiProperty({ example: 'Negare User' })
  fullName!: string;

  @ApiPropertyOptional({ example: 'https://cdn.negare.test/avatar.png' })
  avatarUrl?: string | null;

  @ApiPropertyOptional({ example: 'user@negare.test' })
  email?: string | null;

  @ApiPropertyOptional({ example: '+989121234567' })
  phone?: string | null;
}

export class AdminNotificationsTimelineLinkDto {
  @ApiPropertyOptional({ example: 'PRODUCT' })
  entityType?: string | null;

  @ApiPropertyOptional({ example: 'vector-pack-2024' })
  entitySlug?: string | null;

  @ApiPropertyOptional({ example: '/products/vector-pack-2024' })
  href?: string | null;
}

export class AdminNotificationsTimelineItemDto {
  @ApiProperty({ enum: ['broadcast', 'event'] })
  kind!: 'broadcast' | 'event';

  @ApiProperty({ example: 'notification-or-delivery-uuid' })
  id!: string;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiProperty({ example: 'You have a new notification.' })
  message!: string;

  @ApiProperty({ example: '2025-01-01T10:00:00.000Z' })
  sentAt!: string;

  @ApiPropertyOptional({ example: '2025-01-01T10:05:00.000Z' })
  readAt?: string | null;

  @ApiPropertyOptional({ type: AdminNotificationsTimelineSenderDto })
  sender?: AdminNotificationsTimelineSenderDto;

  @ApiPropertyOptional({ type: AdminNotificationsTimelineRecipientDto })
  recipient?: AdminNotificationsTimelineRecipientDto;

  @ApiPropertyOptional({ type: AdminNotificationsTimelineLinkDto })
  link?: AdminNotificationsTimelineLinkDto;
}

export class AdminNotificationsTimelineResponseDto {
  @ApiProperty({ type: [AdminNotificationsTimelineItemDto] })
  items!: AdminNotificationsTimelineItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
