import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationStatus, NotificationType } from '@prisma/client';
import { PaginationMetaDto } from '@app/common/dto/pagination.dto';

export class NotificationInboxItemDto {
  @ApiProperty({ description: 'User notification id' })
  id!: string;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiPropertyOptional() actionUrl?: string | null;
  @ApiPropertyOptional({
    type: 'object',
    properties: {
      entityType: { type: 'string', nullable: true },
      entitySlug: { type: 'string', nullable: true },
      entityId: { type: 'string', nullable: true },
      href: { type: 'string', nullable: true },
    },
  })
  link?: {
    entityType?: string | null;
    entitySlug?: string | null;
    entityId?: string | null;
    href?: string | null;
  };
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  data?: Record<string, unknown> | null;

  @ApiProperty({ enum: NotificationStatus })
  status!: NotificationStatus;

  @ApiProperty({ description: 'User notification createdAt' })
  createdAt!: string;
  @ApiProperty({ description: 'Base notification createdAt' })
  notificationCreatedAt!: string;
  @ApiPropertyOptional({ description: 'Delivery time for user notification' })
  deliveredAt?: string | null;
  @ApiPropertyOptional() readAt?: string | null;
}

export class NotificationInboxResponseDto {
  @ApiProperty({ type: [NotificationInboxItemDto] })
  items!: NotificationInboxItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class NotificationUnreadCountDto {
  @ApiProperty({ example: 3 })
  count!: number;
}

export class NotificationUpdateCountDto {
  @ApiProperty({ example: 5 })
  updatedCount!: number;
}
