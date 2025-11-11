/**
 * UserRolesController exposes admin endpoints to browse and mutate user–role assignments.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '@app/common/decorators/roles.decorator';
import { AssignRoleDto } from '@app/core/roles/dto/assign-role.dto';
import { FindUserRolesQueryDto } from '@app/core/roles/dto/find-user-roles-query.dto';
import { UserRoleIdParamDto } from '@app/core/roles/dto/user-role-id-param.dto';
import { UserRolesService } from '@app/core/roles/user-roles.service';
import { RoleName } from '@prisma/client';

@ApiTags('User Roles')
@ApiBearerAuth('bearer')
@Controller('core/user-roles')
/**
 * Provides CRUD-ish operations for the user–role join table.
 */
export class UserRolesController {
  constructor(private readonly userRolesService: UserRolesService) {}

  /**
   * Lists user–role assignments with optional filters (admin-only).
   */
  @Get()
  @Roles(RoleName.admin)
  @ApiOperation({
    summary: 'List user–role assignments',
    description:
      'Returns user–role assignments filtered by userId, roleId, or roleName.',
  })
  @ApiResponse({ status: 200, description: 'Assignments retrieved.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  findAll(@Query() query: FindUserRolesQueryDto) {
    return this.userRolesService.findAll(query);
  }

  /**
   * Assigns a role to a user (admin-only).
   * Supports either roleId or roleName in the payload.
   */
  @Post()
  @Roles(RoleName.admin)
  @ApiOperation({
    summary: 'Assign role to user',
    description:
      'Attaches the specified role (by roleId or roleName) to the target user.',
  })
  @ApiResponse({ status: 201, description: 'Role assigned.' })
  @ApiResponse({ status: 404, description: 'User or role not found.' })
  @ApiResponse({ status: 409, description: 'Role already assigned.' })
  assignRole(@Body() dto: AssignRoleDto) {
    return this.userRolesService.assignRole(dto);
  }

  /**
   * Deletes a user–role assignment by its identifier (admin-only).
   */
  @Delete(':id')
  @Roles(RoleName.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove role from user',
    description: 'Deletes a user–role assignment by its UUID identifier.',
  })
  @ApiResponse({ status: 200, description: 'Assignment removed.' })
  @ApiResponse({ status: 404, description: 'Assignment not found.' })
  remove(@Param() params: UserRoleIdParamDto) {
    return this.userRolesService.remove(params.id);
  }
}
