import {
  Body,
  Controller,
  ForbiddenException,
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
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserIdParamDto } from './dto/user-id-param.dto';
import { UsersService } from './users.service';
import { RoleName } from '../roles/role.entity';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('core/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'List users' })
  @ApiResponse({ status: 200, description: 'List of users returned successfully' })
  findAll(@Query() query: FindUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by id' })
  @ApiResponse({ status: 200, description: 'User fetched successfully' })
  findById(
    @Param() params: UserIdParamDto,
    @CurrentUser() currentUser: CurrentUserPayload | undefined,
  ) {
    this.ensureUserAccess(params.id, currentUser);
    return this.usersService.findById(params.id);
  }

  @Post()
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Create user' })
  @ApiResponse({ status: 201, description: 'User created' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Patch(':id')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, description: 'User updated' })
  update(
    @Param() params: UserIdParamDto,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(params.id, updateUserDto);
  }

  private ensureUserAccess(
    userId: string,
    currentUser: CurrentUserPayload | undefined,
  ) {
    if (!currentUser) {
      throw new ForbiddenException('Access denied');
    }

    const isOwner = currentUser.id === userId;
    const isAdmin = currentUser.roles?.includes(RoleName.ADMIN);

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Access denied');
    }
  }
}
