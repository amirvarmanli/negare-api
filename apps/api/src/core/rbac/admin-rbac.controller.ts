import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
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
import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { UserIdParamDto } from '@app/core/users/dto/user-id-param.dto';
import { AdminAccessDto } from '@app/core/rbac/dto/admin-access.dto';
import { PermissionDto } from '@app/core/rbac/dto/permission.dto';
import { UpdateUserPermissionsDto } from '@app/core/rbac/dto/update-user-permissions.dto';
import { UpdateUserRoleDto } from '@app/core/rbac/dto/update-user-role.dto';
import { AdminRbacService } from '@app/core/rbac/admin-rbac.service';

@ApiTags('Admin RBAC')
@ApiBearerAuth()
@Controller('admin')
export class AdminRbacController {
  constructor(private readonly rbacService: AdminRbacService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.users:read')
  @ApiOperation({ summary: 'Get current admin access snapshot' })
  @ApiOkResponse({ type: AdminAccessDto })
  async me(
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<AdminAccessDto> {
    if (!user) {
      throw new ForbiddenException('Authentication required.');
    }
    const snapshot = await this.rbacService.getUserAccess(user.id);
    return {
      id: snapshot.userId,
      role: snapshot.role,
      permissions: snapshot.permissions,
    };
  }

  @Get('permissions')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.users:manage')
  @ApiOperation({ summary: 'List all permissions' })
  @ApiOkResponse({ type: [PermissionDto] })
  async listPermissions(): Promise<PermissionDto[]> {
    return this.rbacService.listPermissions();
  }

  @Patch('users/:id/permissions')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.users:manage')
  @ApiOperation({ summary: 'Update user extra permissions' })
  @ApiOkResponse({ type: AdminAccessDto })
  @ApiResponse({ status: 400, description: 'Unknown permission key.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async updatePermissions(
    @Param() params: UserIdParamDto,
    @Body() dto: UpdateUserPermissionsDto,
  ): Promise<AdminAccessDto> {
    const snapshot = await this.rbacService.updateUserPermissions(
      params.id,
      dto.add ?? [],
      dto.remove ?? [],
    );

    return {
      id: snapshot.userId,
      role: snapshot.role,
      permissions: snapshot.permissions,
    };
  }

  @Patch('users/:id/role')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.users:manage')
  @ApiOperation({ summary: 'Update user role' })
  @ApiOkResponse({ type: AdminAccessDto })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async updateRole(
    @Param() params: UserIdParamDto,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<AdminAccessDto> {
    const snapshot = await this.rbacService.updateUserRole(params.id, dto.role);
    return {
      id: snapshot.userId,
      role: snapshot.role,
      permissions: snapshot.permissions,
    };
  }
}
