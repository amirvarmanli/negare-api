// apps/api/src/core/users/skills/skills.controller.ts
import {
  Body,
  Controller,
  Delete,
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

import { SkillsService } from './skills.service';
import { SkillCreateDto } from './dtos/skill-create.dto';
import { SkillUpdateDto } from './dtos/skill-update.dto';
import { SkillQueryDto } from './dtos/skill-query.dto';
import { SkillListResultDto, SkillDto } from './dtos/skill-response.dto';
import { UserSkillsSetDto } from './dtos/user-skills-set.dto';

import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { Roles } from '@app/common/decorators/roles.decorator';
import { Public } from '@app/common/decorators/public.decorator';
import { RoleName } from '@prisma/client';

@ApiTags('Skills')
@Controller('users/skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  // =======================================================================
  // ADMIN: مدیریت کامل مهارت‌ها (CRUD)
  // =======================================================================

  @Post()
  @ApiBearerAuth('bearer')
  @Roles(RoleName.admin)
  @ApiOperation({ summary: '[Admin] ایجاد مهارت جدید' })
  @ApiResponse({ status: 201, type: SkillDto })
  create(@Body() dto: SkillCreateDto): Promise<SkillDto> {
    return this.skillsService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth('bearer')
  @Roles(RoleName.admin)
  @ApiOperation({ summary: '[Admin] ویرایش مهارت' })
  @ApiResponse({ status: 200, type: SkillDto })
  update(
    @Param('id') id: string,
    @Body() dto: SkillUpdateDto,
  ): Promise<SkillDto> {
    return this.skillsService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('bearer')
  @Roles(RoleName.admin)
  @ApiOperation({ summary: '[Admin] حذف مهارت' })
  @ApiResponse({ status: 204 })
  async remove(@Param('id') id: string): Promise<void> {
    await this.skillsService.remove(id);
  }

  @Get()
  @ApiBearerAuth('bearer')
  @Roles(RoleName.admin)
  @ApiOperation({ summary: '[Admin] لیست همه مهارت‌ها (با فیلتر)' })
  @ApiResponse({ status: 200, type: SkillListResultDto })
  findAll(@Query() query: SkillQueryDto): Promise<SkillListResultDto> {
    return this.skillsService.findAll(query);
  }

  // =======================================================================
  // PUBLIC: مهارت‌های فعال سیستم – برای فرم‌ها، فیلتر و پروفایل
  // =======================================================================

  @Get('public/active')
  @Public()
  @ApiOperation({
    summary: 'لیست مهارت‌های فعال (کاملاً عمومی)',
    description:
      'برای فرم ثبت‌نام، فیلتر هنرمندان و صفحه پروفایل هنرمند استفاده می‌شود. بدون لاگین قابل دسترسی است.',
  })
  @ApiResponse({ status: 200, type: SkillListResultDto })
  getActiveForPublic(): Promise<SkillListResultDto> {
    return this.skillsService.findPublicActive();
  }

  // =======================================================================
  // PUBLIC: مهارت‌های یک کاربر خاص – برای صفحه پروفایل هنرمند
  // =======================================================================

  @Get('by-id/:userId')
  @Public()
  @ApiOperation({
    summary: 'مهارت‌های یک هنرمند بر اساس userId (کاملاً عمومی)',
    description:
      'برای نمایش مهارت‌ها در صفحه پروفایل هنرمند — حتی کاربران مهمان هم باید ببینند.',
  })
  @ApiResponse({ status: 200, type: SkillListResultDto })
  getUserSkillsById(
    @Param('userId') userId: string,
  ): Promise<SkillListResultDto> {
    return this.skillsService.getUserSkillsById(userId);
  }

  @Get('by-username/:username')
  @Public()
  @ApiOperation({
    summary: 'مهارت‌های یک هنرمند بر اساس نام کاربری (کاملاً عمومی)',
    description:
      'برای URLهای زیبا مثل /@username — بدون نیاز به لاگین قابل دسترسی است.',
  })
  @ApiResponse({ status: 200, type: SkillListResultDto })
  getUserSkillsByUsername(
    @Param('username') username: string,
  ): Promise<SkillListResultDto> {
    return this.skillsService.getUserSkillsByUsername(username);
  }

  // =======================================================================
  // AUTHENTICATED USER: مدیریت مهارت‌های خود کاربر
  // =======================================================================

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'دریافت مهارت‌های کاربر فعلی' })
  @ApiResponse({ status: 200, type: SkillListResultDto })
  getMySkills(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<SkillListResultDto> {
    return this.skillsService.getUserSkillsById(user.id);
  }

  @Patch('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'به‌روزرسانی مهارت‌های کاربر فعلی',
    description: 'لیست skillKeys ارسال شده جایگزین همه مهارت‌های قبلی می‌شود.',
  })
  @ApiResponse({ status: 200, type: SkillListResultDto })
  updateMySkills(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: UserSkillsSetDto,
  ): Promise<SkillListResultDto> {
    return this.skillsService.setUserSkillsByUserIdAndKeys(
      user.id,
      body.skillKeys,
    );
  }

  // =======================================================================
  // ADMIN: مدیریت مهارت‌های کاربران دیگر
  // =======================================================================

  @Patch('by-id/:userId')
  @ApiBearerAuth('bearer')
  @Roles(RoleName.admin)
  @ApiOperation({ summary: '[Admin] تنظیم مهارت‌های کاربر بر اساس userId' })
  @ApiResponse({ status: 200, type: SkillListResultDto })
  updateUserSkillsById(
    @Param('userId') userId: string,
    @Body() body: UserSkillsSetDto,
  ): Promise<SkillListResultDto> {
    return this.skillsService.setUserSkillsByUserIdAndKeys(
      userId,
      body.skillKeys,
    );
  }

  @Patch('by-username/:username')
  @ApiBearerAuth('bearer')
  @Roles(RoleName.admin)
  @ApiOperation({ summary: '[Admin] تنظیم مهارت‌های کاربر بر اساس نام کاربری' })
  @ApiResponse({ status: 200, type: SkillListResultDto })
  updateUserSkillsByUsername(
    @Param('username') username: string,
    @Body() body: UserSkillsSetDto,
  ): Promise<SkillListResultDto> {
    return this.skillsService.setUserSkillsByUsernameAndKeys(
      username,
      body.skillKeys,
    );
  }
}
