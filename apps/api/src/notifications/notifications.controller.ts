import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { OkResponseDto } from '@app/common/dto/ok-response.dto';
import { NotificationsService } from '@app/notifications/notifications.service';
import { NotificationListQueryDto } from '@app/notifications/dtos/notification-query.dto';
import {
  NotificationInboxResponseDto,
  NotificationUnreadCountDto,
  NotificationUnreadCountResponseDto,
  NotificationUpdateCountDto,
} from '@app/notifications/dtos/notification-inbox.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @Permissions('user.notifications:read')
  @ApiOperation({ summary: 'List current user notifications' })
  @ApiOkResponse({ type: NotificationInboxResponseDto })
  async list(
    @Query() query: NotificationListQueryDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<NotificationInboxResponseDto> {
    const userId = requireUserId(user);
    return this.service.listInbox(userId, query);
  }

  @Get('unread-count')
  @Permissions('user.notifications:read')
  @ApiOperation({ summary: 'Get unread notifications count' })
  @ApiOkResponse({ type: NotificationUnreadCountDto })
  async unreadCount(
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<NotificationUnreadCountDto> {
    const userId = requireUserId(user);
    const count = await this.service.countUnread(userId);
    return { count };
  }

  @Get('unread-counts')
  @Permissions('user.notifications:read')
  @ApiOperation({
    summary: 'Get unread notifications count (simple)',
    description:
      'Returns the unread notifications count for the current authenticated user.',
  })
  @ApiOkResponse({ type: NotificationUnreadCountResponseDto })
  async unreadCountSimple(
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<NotificationUnreadCountResponseDto> {
    const userId = requireUserId(user);
    const count = await this.service.countUnread(userId);
    return { unreadCount: count };
  }

  @Patch(':id/read')
  @Permissions('user.notifications:manage')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiOkResponse({ type: OkResponseDto })
  @ApiParam({ name: 'id', description: 'User notification id' })
  async markRead(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<OkResponseDto> {
    if (!id || id.trim().length === 0) {
      throw new BadRequestException('Notification id is required.');
    }
    const userId = requireUserId(user);
    const updated = await this.service.markRead(userId, id);
    if (!updated) {
      throw new NotFoundException('Notification not found.');
    }
    return { ok: true };
  }

  @Patch('read-all')
  @Permissions('user.notifications:manage')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiOkResponse({ type: NotificationUpdateCountDto })
  async markAllRead(
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<NotificationUpdateCountDto> {
    const userId = requireUserId(user);
    const updatedCount = await this.service.markAllRead(userId);
    return { updatedCount };
  }

  @Delete(':id')
  @Permissions('user.notifications:manage')
  @ApiOperation({ summary: 'Archive a notification' })
  @ApiOkResponse({ type: OkResponseDto })
  @ApiParam({ name: 'id', description: 'User notification id' })
  @HttpCode(HttpStatus.OK)
  async archive(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<OkResponseDto> {
    if (!id || id.trim().length === 0) {
      throw new BadRequestException('Notification id is required.');
    }
    const userId = requireUserId(user);
    const updated = await this.service.archive(userId, id);
    if (!updated) {
      throw new NotFoundException('Notification not found.');
    }
    return { ok: true };
  }
}
