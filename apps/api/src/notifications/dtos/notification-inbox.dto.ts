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
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Optional metadata. Wallet transaction notifications include { type, amount, direction, reason, walletUserId, orderId?, paymentId?, actorUserId?, couponCode?, productId?, links, timestamp, traceId }.',
    example: {
      type: 'CREDIT',
      amount: 500000,
      direction: 'increase',
      reason: 'TOPUP',
      walletUserId: 'user-1',
      orderId: 'order-1',
      paymentId: 'payment-1',
      actorUserId: 'user-1',
      couponCode: null,
      productId: '123',
      traceId: 'trace-abc',
      timestamp: '2026-01-01T00:00:00.000Z',
      links: {
        wallet: '/admin/finance/wallets/user-1',
        order: '/admin/orders/order-1',
        payment: '/admin/finance/payments/payment-1',
        user: '/admin/users/user-1',
        product: '/products/123',
      },
    },
  })
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

export class NotificationUnreadCountResponseDto {
  @ApiProperty({ example: 3 })
  unreadCount!: number;
}

export class NotificationUpdateCountDto {
  @ApiProperty({ example: 5 })
  updatedCount!: number;
}
