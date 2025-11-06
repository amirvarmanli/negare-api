import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUsernameDto } from './dto/update-username.dto';
import { NoCacheInterceptor } from '@app/common/interceptors/no-cache.interceptor';

@ApiTags('User Profile')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@UseInterceptors(NoCacheInterceptor)
@Controller('core/profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // ───────────────────────────────
  // GET /core/profile
  // ───────────────────────────────
  @Get()
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Returns the latest profile information for the authenticated user.',
  })
  async getProfile(@CurrentUser() currentUser: CurrentUserPayload | undefined) {
    const userId = this.ensureUser(currentUser);
    const profile = await this.profileService.getProfile(userId);
    return { success: true as const, data: profile };
  }

  // ───────────────────────────────
  // PATCH /core/profile
  // ───────────────────────────────
  @Patch()
  @ApiOperation({
    summary: 'Update current user profile',
    description:
      'Updates name, bio, city, and avatarUrl. Email/phone must use OTP flow.',
  })
  async updateProfile(
    @CurrentUser() currentUser: CurrentUserPayload | undefined,
    @Body() dto: UpdateProfileDto,
  ) {
    const userId = this.ensureUser(currentUser);
    const profile = await this.profileService.updateProfile(userId, dto);
    return { success: true as const, data: profile };
  }

  // ───────────────────────────────
  // GET /core/profile/username/check?username=x
  // ───────────────────────────────
  @Get('username/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check username availability',
    description:
      'Validates username format and returns whether it is available for registration.',
  })
  @ApiQuery({ name: 'username', required: true, example: 'negare_user' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        ok: true,
        available: true,
        username: 'negare_user',
      },
    },
  })
  async checkUsername(@Query('username') username: string) {
    const result =
      await this.profileService.checkUsernameAvailability(username);
    return result;
  }

  // ───────────────────────────────
  // PATCH /core/profile/username
  // ───────────────────────────────
  @Patch('username')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change username',
    description:
      'Allows the authenticated user to change their username if valid and available.',
  })
  @ApiResponse({
    status: 200,
    description: 'Username changed successfully.',
    schema: {
      example: {
        success: true,
        data: {
          id: 'c1d5f0bc-6f46-4ae4-9b28-2d7574156d1b',
          username: 'amir_varmanli',
          name: 'Amir Hossein',
          email: 'user@example.com',
          phone: '09121234567',
          bio: 'Capital markets enthusiast',
          city: 'Shiraz',
          avatarUrl: 'https://cdn.negare.com/avatar.png',
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-02-01T10:00:00.000Z',
        },
      },
    },
  })
  async updateUsername(
    @CurrentUser() currentUser: CurrentUserPayload | undefined,
    @Body() dto: UpdateUsernameDto,
  ) {
    const userId = this.ensureUser(currentUser);
    const profile = await this.profileService.updateUsername(
      userId,
      dto.username,
    );
    return { success: true as const, data: profile };
  }

  // ───────────────────────────────
  // Guard for user existence
  // ───────────────────────────────
  private ensureUser(currentUser: CurrentUserPayload | undefined): string {
    if (!currentUser?.id) {
      throw new UnauthorizedException('User context is missing.');
    }
    return currentUser.id;
  }
}
