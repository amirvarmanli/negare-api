import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@app/common/guards/permissions.guard';
import { Permissions } from '@app/common/decorators/permissions.decorator';
import { AdminUsersService } from '@app/core/users/admin/admin-users.service';
import { AdminUsersQueryDto } from '@app/core/users/admin/dto/admin-users-query.dto';
import { AdminUsersListResponseDto } from '@app/core/users/admin/dto/admin-users-list.dto';
import { AdminCreateUserDto } from '@app/core/users/admin/dto/admin-create-user.dto';
import { AdminUserDto } from '@app/core/users/admin/dto/admin-user.dto';
import { AdminUsersFiltersResponseDto } from '@app/core/users/admin/dto/admin-users-filters.dto';
import { AdminUserDetailResponseDto } from '@app/core/users/admin/dto/admin-user-detail.dto';
import {
  AdminUserDownloadsResponseDto,
  AdminUserDownloadsQueryDto,
  AdminUserNotificationsResponseDto,
  AdminUserPurchasesResponseDto,
  AdminUserSubresourceQueryDto,
  AdminUserTransactionsResponseDto,
} from '@app/core/users/admin/dto/admin-user-subresources.dto';

@ApiTags('Admin - Users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @Permissions('admin.users:read')
  @ApiOperation({ summary: 'List users archive (admin)' })
  @ApiOkResponse({ type: AdminUsersListResponseDto })
  async listUsers(
    @Query() query: AdminUsersQueryDto,
  ): Promise<AdminUsersListResponseDto> {
    return this.adminUsersService.listUsers(query);
  }

  @Get(':id')
  @Permissions('admin.users:read')
  @ApiOperation({ summary: 'Get admin user detail' })
  @ApiOkResponse({ type: AdminUserDetailResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  async getUserDetail(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AdminUserDetailResponseDto> {
    return this.adminUsersService.getUserDetail(id);
  }

  @Get(':id/purchases')
  @Permissions('admin.users:read')
  @ApiOperation({ summary: 'List admin user purchases' })
  @ApiOkResponse({ type: AdminUserPurchasesResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  async listUserPurchases(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: AdminUserSubresourceQueryDto,
  ): Promise<AdminUserPurchasesResponseDto> {
    return this.adminUsersService.listUserPurchases(id, query);
  }

  @Get(':id/downloads')
  @Permissions('admin.users:read')
  @ApiOperation({ summary: 'List admin user downloads' })
  @ApiOkResponse({ type: AdminUserDownloadsResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({ name: 'from', required: false, example: '2025-01-01' })
  @ApiQuery({ name: 'to', required: false, example: '2025-01-31' })
  @ApiQuery({ name: 'freeOnly', required: false, example: true })
  async listUserDownloads(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: AdminUserDownloadsQueryDto,
  ): Promise<AdminUserDownloadsResponseDto> {
    return this.adminUsersService.listUserDownloads(id, query);
  }

  @Get(':id/transactions')
  @Permissions('admin.users:read')
  @ApiOperation({ summary: 'List admin user transactions' })
  @ApiOkResponse({ type: AdminUserTransactionsResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  async listUserTransactions(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: AdminUserSubresourceQueryDto,
  ): Promise<AdminUserTransactionsResponseDto> {
    return this.adminUsersService.listUserTransactions(id, query);
  }

  @Get(':id/notifications')
  @Permissions('admin.users:read')
  @ApiOperation({ summary: 'List admin user notifications' })
  @ApiOkResponse({ type: AdminUserNotificationsResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  async listUserNotifications(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: AdminUserSubresourceQueryDto,
  ): Promise<AdminUserNotificationsResponseDto> {
    return this.adminUsersService.listUserNotifications(id, query);
  }

  @Post()
  @Permissions('admin.users:manage')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiOkResponse({ type: AdminUserDto })
  @ApiResponse({ status: 400, description: 'Validation or uniqueness error.' })
  async createUser(@Body() dto: AdminCreateUserDto): Promise<AdminUserDto> {
    return this.adminUsersService.createUser(dto);
  }

  @Get('filters')
  @Permissions('admin.users:read')
  @ApiOperation({ summary: 'Get filters for admin user list' })
  @ApiOkResponse({ type: AdminUsersFiltersResponseDto })
  async getFilters(): Promise<AdminUsersFiltersResponseDto> {
    return this.adminUsersService.getFilters();
  }
}
