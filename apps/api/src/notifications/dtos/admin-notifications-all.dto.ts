import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationTargetGroup, NotificationType } from '@prisma/client';

export class AdminNotificationsMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;
  @ApiProperty({ example: 20 })
  limit!: number;
  @ApiProperty({ example: 100 })
  total!: number;
  @ApiProperty({ example: 5 })
  totalPages!: number;
}

export class AdminNotificationsAllItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: NotificationType }) type!: NotificationType;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiPropertyOptional() actionUrl?: string | null;
  @ApiPropertyOptional({ enum: NotificationTargetGroup })
  targetGroup?: NotificationTargetGroup | null;
  @ApiPropertyOptional() createdById?: string | null;
  @ApiPropertyOptional() createdByName?: string | null;
  @ApiPropertyOptional() createdByUsername?: string | null;
  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  data?: Record<string, unknown> | null;
}

export class AdminNotificationsAllResponseDto {
  @ApiProperty({ type: [AdminNotificationsAllItemDto] })
  items!: AdminNotificationsAllItemDto[];

  @ApiProperty({ type: AdminNotificationsMetaDto })
  meta!: AdminNotificationsMetaDto;
}
