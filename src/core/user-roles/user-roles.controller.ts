import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleName } from '../roles/role.entity';
import { AssignRoleDto } from './dto/assign-role.dto';
import { FindUserRolesQueryDto } from './dto/find-user-roles-query.dto';
import { UserRoleIdParamDto } from './dto/user-role-id-param.dto';
import { UserRolesService } from './user-roles.service';

@ApiTags('User Roles')
@ApiBearerAuth()
@Controller('core/user-roles')
export class UserRolesController {
  constructor(private readonly userRolesService: UserRolesService) {}

  @Get()
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'List user roles' })
  @ApiResponse({ status: 200, description: 'User roles returned' })
  findAll(@Query() query: FindUserRolesQueryDto) {
    return this.userRolesService.findAll(query);
  }

  @Post()
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Assign role to user' })
  @ApiResponse({ status: 201, description: 'Role assigned' })
  assignRole(@Body() dto: AssignRoleDto) {
    return this.userRolesService.assignRole(dto);
  }

  @Delete(':id')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Remove user role' })
  @ApiResponse({ status: 200, description: 'User role removed' })
  remove(@Param() params: UserRoleIdParamDto) {
    return this.userRolesService.remove(params.id);
  }
}
