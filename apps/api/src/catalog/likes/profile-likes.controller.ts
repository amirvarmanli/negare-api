import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { requireUserId } from '@app/catalog/utils/current-user.util';
import { LikesService } from '@app/catalog/likes/likes.service';
import { UserLikesResultDto } from '@app/catalog/likes/dtos/likes-response.dto';

@ApiTags('Profile / Likes')
@ApiBearerAuth()
@Controller('catalog/profile/likes')
export class ProfileLikesController {
  constructor(private readonly service: LikesService) {}

  @Get()
  @ApiOperation({ summary: 'List current user liked products' })
  @ApiOkResponse({ type: UserLikesResultDto })
  async listMine(
    @CurrentUser() user: CurrentUserPayload | undefined,
    @Query('limit') limit = '24',
    @Query('cursor') cursor?: string,
  ): Promise<UserLikesResultDto> {
    const userId = requireUserId(user);
    return this.service.listForUser(userId, Number(limit), cursor);
  }
}
