import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class AdminNotificationsFeedLinkDto {
  @ApiPropertyOptional({ example: 'PRODUCT' })
  entityType?: string | null;

  @ApiPropertyOptional({ example: 'vector-pack-2024' })
  entitySlug?: string | null;

  @ApiPropertyOptional({ example: '/products/vector-pack-2024' })
  href?: string | null;
}

export class AdminNotificationsFeedRecipientDto {
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

export class AdminNotificationsFeedItemDto {
  @ApiProperty({ example: 'user-notification-uuid' })
  id!: string;

  @ApiProperty({ example: 'You have a new notification.' })
  message!: string;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiProperty({ example: '2025-01-01T10:00:00.000Z' })
  sentAt!: string;

  @ApiPropertyOptional({ example: '2025-01-01T10:05:00.000Z' })
  readAt?: string | null;

  @ApiProperty({ type: AdminNotificationsFeedLinkDto })
  link!: AdminNotificationsFeedLinkDto;

  @ApiProperty({ type: AdminNotificationsFeedRecipientDto })
  recipient!: AdminNotificationsFeedRecipientDto;
}

export class AdminNotificationsFeedMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 120 })
  total!: number;

  @ApiProperty({ example: 6 })
  totalPages!: number;
}

export class AdminNotificationsFeedResponseDto {
  @ApiProperty({ type: [AdminNotificationsFeedItemDto] })
  items!: AdminNotificationsFeedItemDto[];

  @ApiProperty({ type: AdminNotificationsFeedMetaDto })
  meta!: AdminNotificationsFeedMetaDto;
}

export class AdminNotificationsFeedDeleteResponseDto {
  @ApiProperty({ example: true })
  success!: true;
}
