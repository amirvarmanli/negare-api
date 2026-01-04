import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '@app/common/decorators/current-user.decorator';
import { Permissions } from '@app/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@app/common/guards/permissions.guard';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { requireUserId } from '@app/catalog/utils/current-user.util';
import { NotificationsService } from '@app/notifications/notifications.service';
import {
  AdminBroadcastRequestDto,
  AdminBroadcastResponseDto,
  AdminBroadcastListDto,
  AdminBroadcastDeleteResponseDto,
} from '@app/notifications/dtos/admin-broadcast.dto';
import { AdminBroadcastQueryDto } from '@app/notifications/dtos/admin-broadcast-query.dto';
import { NotificationType } from '@prisma/client';
import { AdminNotificationsAllQueryDto } from '@app/notifications/dtos/admin-notifications-all-query.dto';
import { AdminNotificationsAllResponseDto } from '@app/notifications/dtos/admin-notifications-all.dto';
import {
  AdminNotificationsFeedDeleteResponseDto,
  AdminNotificationsFeedResponseDto,
} from '@app/notifications/dtos/admin-notifications-feed.dto';
import { AdminNotificationsFeedQueryDto } from '@app/notifications/dtos/admin-notifications-feed-query.dto';
import { AdminNotificationsBroadcastRecipientsQueryDto } from '@app/notifications/dtos/admin-notifications-broadcast-recipients-query.dto';
import {
  AdminNotificationsTimelineQueryDto,
  AdminNotificationsTimelineResponseDto,
} from '@app/notifications/dtos/admin-notifications-timeline.dto';

@ApiTags('Admin - Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Post('broadcast')
  @Permissions('admin.notifications:send')
  @ApiOperation({ summary: 'Broadcast a notification' })
  @ApiCreatedResponse({ type: AdminBroadcastResponseDto })
  async broadcast(
    @Body() dto: AdminBroadcastRequestDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<AdminBroadcastResponseDto> {
    const adminId = requireUserId(user);
    const data = dto.data
      ? { ...dto.data, targetGroup: dto.targetGroup }
      : { targetGroup: dto.targetGroup };
    const notificationId = await this.service.createNotification({
      type: NotificationType.ADMIN_BROADCAST,
      title: dto.title,
      body: dto.body,
      actionUrl: dto.actionUrl ?? null,
      data,
      createdById: adminId,
    });
    await this.service.enqueueToGroup(notificationId, dto.targetGroup);
    return { notificationId, queued: true };
  }

  @Get()
  @Permissions('admin.notifications:read')
  @ApiOperation({ summary: 'List broadcast notifications' })
  @ApiOkResponse({ type: AdminBroadcastListDto })
  async list(
    @Query() query: AdminBroadcastQueryDto,
  ): Promise<AdminBroadcastListDto> {
    return this.service.listBroadcasts(query);
  }

  @Get('all')
  @Permissions('admin.notifications:read')
  @ApiOperation({ summary: 'List all notifications (admin)' })
  @ApiOkResponse({ type: AdminNotificationsAllResponseDto })
  async listAll(
    @Query() query: AdminNotificationsAllQueryDto,
  ): Promise<AdminNotificationsAllResponseDto> {
    return this.service.listAll(query);
  }

  @Get('feed')
  @Permissions('admin.notifications:read')
  @ApiOperation({ summary: 'List notification deliveries (admin feed)' })
  @ApiOkResponse({ type: AdminNotificationsFeedResponseDto })
  async feed(
    @Query() query: AdminNotificationsFeedQueryDto,
  ): Promise<AdminNotificationsFeedResponseDto> {
    return this.service.listAdminFeed(query);
  }

  @Get('broadcasts')
  @Permissions('admin.notifications:read')
  @ApiOperation({ summary: 'List broadcast notifications' })
  @ApiOkResponse({ type: AdminBroadcastListDto })
  async broadcasts(
    @Query() query: AdminBroadcastQueryDto,
  ): Promise<AdminBroadcastListDto> {
    return this.service.listBroadcasts(query);
  }

  @Get('broadcasts/:notificationId/recipients')
  @Permissions('admin.notifications:read')
  @ApiOperation({ summary: 'List broadcast recipients (per-delivery)' })
  @ApiParam({ name: 'notificationId', description: 'Broadcast notification id' })
  @ApiOkResponse({ type: AdminNotificationsFeedResponseDto })
  async broadcastRecipients(
    @Param('notificationId') notificationId: string,
    @Query() query: AdminNotificationsBroadcastRecipientsQueryDto,
  ): Promise<AdminNotificationsFeedResponseDto> {
    return this.service.listBroadcastRecipients(notificationId, query);
  }

  @Delete('broadcasts/:notificationId')
  @Permissions('admin.notifications:read')
  @ApiOperation({ summary: 'Delete broadcast notification (global delete)' })
  @ApiParam({ name: 'notificationId', description: 'Broadcast notification id' })
  @ApiOkResponse({ type: AdminBroadcastDeleteResponseDto })
  async deleteBroadcast(
    @Param('notificationId') notificationId: string,
  ): Promise<AdminBroadcastDeleteResponseDto> {
    return this.service.deleteBroadcast(notificationId);
  }

  @Delete('feed/:recipientRowId')
  @Permissions('admin.notifications:read')
  @ApiOperation({ summary: 'Soft delete a notification delivery (admin feed)' })
  @ApiParam({ name: 'recipientRowId', description: 'User notification id' })
  @ApiOkResponse({ type: AdminNotificationsFeedDeleteResponseDto })
  async deleteFeedRow(
    @Param('recipientRowId') recipientRowId: string,
  ): Promise<AdminNotificationsFeedDeleteResponseDto> {
    return this.service.deleteAdminFeedRecipient(recipientRowId);
  }

  @Get('timeline')
  @Permissions('admin.notifications:read')
  @ApiOperation({
    summary: 'List unified notifications timeline (broadcasts + deliveries)',
  })
  @ApiOkResponse({ type: AdminNotificationsTimelineResponseDto })
  async timeline(
    @Query() query: AdminNotificationsTimelineQueryDto,
  ): Promise<AdminNotificationsTimelineResponseDto> {
    return this.service.listTimeline(query);
  }
}
