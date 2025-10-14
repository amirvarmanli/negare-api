import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { FindRolesQueryDto } from './dto/find-roles-query.dto';
import { RoleNameParamDto } from './dto/role-name-param.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';
import { RoleName } from './role.entity';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('core/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'List roles' })
  @ApiResponse({ status: 200, description: 'List of roles' })
  findAll(@Query() query: FindRolesQueryDto) {
    return this.rolesService.findAll(query);
  }

  @Get(':name')
  @ApiOperation({ summary: 'Find role by name' })
  @ApiResponse({ status: 200, description: 'Role fetched successfully' })
  findByName(@Param() params: RoleNameParamDto) {
    return this.rolesService.findByName(params.name);
  }

  @Post()
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Create role' })
  @ApiResponse({ status: 201, description: 'Role created' })
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Patch(':name')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Update role' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  update(@Param() params: RoleNameParamDto, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(params.name, dto);
  }
}
