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
import { DownloadsService } from '@app/catalog/downloads/downloads.service';
import { UserDownloadsResultDto } from '@app/catalog/downloads/dtos/download-response.dto';

@ApiTags('Profile / Downloads')
@ApiBearerAuth()
@Controller('catalog/profile/downloads')
export class ProfileDownloadsController {
  constructor(private readonly service: DownloadsService) {}

  @Get()
  @ApiOperation({ summary: 'List current user downloads (Load more)' })
  @ApiOkResponse({ type: UserDownloadsResultDto })
  async listMine(
    @CurrentUser() user: CurrentUserPayload | undefined,
    @Query('limit') limit = '24',
    @Query('cursor') cursor?: string,
  ): Promise<UserDownloadsResultDto> {
    const userId = requireUserId(user);
    return this.service.listForUser(userId, Number(limit), cursor);
  }
}
