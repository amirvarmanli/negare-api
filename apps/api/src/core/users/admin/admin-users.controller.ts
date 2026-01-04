import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@app/common/guards/permissions.guard';
import { Permissions } from '@app/common/decorators/permissions.decorator';
import { AdminUsersService } from '@app/core/users/admin/admin-users.service';
import { AdminUsersQueryDto } from '@app/core/users/admin/dto/admin-users-query.dto';
import { AdminUsersResponseDto } from '@app/core/users/admin/dto/admin-users-response.dto';
import { AdminCreateUserDto } from '@app/core/users/admin/dto/admin-create-user.dto';
import { AdminUserDto } from '@app/core/users/admin/dto/admin-user.dto';
import { AdminUsersFiltersResponseDto } from '@app/core/users/admin/dto/admin-users-filters.dto';

@ApiTags('Admin - Users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @Permissions('admin.users:read')
  @ApiOperation({ summary: 'List users with filters and pagination' })
  @ApiOkResponse({ type: AdminUsersResponseDto })
  async listUsers(
    @Query() query: AdminUsersQueryDto,
  ): Promise<AdminUsersResponseDto> {
    return this.adminUsersService.listUsers(query);
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
