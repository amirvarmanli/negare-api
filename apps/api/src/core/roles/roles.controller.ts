/**
 * RolesController exposes administration endpoints for managing role definitions.
 */
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { CreateRoleDto } from '@app/core/roles/dto/create-role.dto';
import { FindRolesQueryDto } from '@app/core/roles/dto/find-roles-query.dto';
import { RoleNameParamDto } from '@app/core/roles/dto/role-name-param.dto';
import { UpdateRoleDto } from '@app/core/roles/dto/update-role.dto';
import { RolesService } from '@app/core/roles/roles.service';
import { RoleName } from '@prisma/client';

@ApiTags('Roles')
@ApiBearerAuth('bearer')
@Controller('core/roles')
/**
 * Provides CRUD-style role management guarded by role-based access control.
 */
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /**
   * Lists roles, optionally filtered, for administrators.
   */
  @Get()
  @Roles(RoleName.admin)
  @ApiOperation({
    summary: 'List roles',
    description: 'Lists roles with optional filtering by name and limit.',
  })
  @ApiResponse({ status: 200, description: 'Roles retrieved successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  findAll(@Query() query: FindRolesQueryDto) {
    return this.rolesService.findAll(query);
  }

  /**
   * Fetches a single role by name (admin-only).
   */
  @Get(':name')
  @Roles(RoleName.admin)
  @ApiOperation({
    summary: 'Get role by name',
    description: 'Returns role details for the provided enum value.',
  })
  @ApiResponse({ status: 200, description: 'Role retrieved successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Role not found.' })
  findByName(@Param() params: RoleNameParamDto) {
    return this.rolesService.findByName(params.name);
  }

  /**
   * Creates a new role record (admin-only).
   */
  @Post()
  @Roles(RoleName.admin)
  @ApiOperation({
    summary: 'Create role',
    description: 'Creates a new role using one of the predefined enum values.',
  })
  @ApiResponse({ status: 201, description: 'Role created successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({
    status: 409,
    description: 'Role with this name already exists.',
  })
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  /**
   * Renames an existing role (admin-only).
   */
  @Patch(':name')
  @Roles(RoleName.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update role',
    description: 'Renames an existing role to a new enum value.',
  })
  @ApiResponse({ status: 200, description: 'Role updated successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Role not found.' })
  @ApiResponse({
    status: 409,
    description: 'Another role already uses the requested name.',
  })
  update(@Param() params: RoleNameParamDto, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(params.name, dto);
  }
}
