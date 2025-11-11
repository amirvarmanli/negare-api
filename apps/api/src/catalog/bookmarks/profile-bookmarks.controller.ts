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
import { BookmarksService } from '@app/catalog/bookmarks/bookmarks.service';
import { BookmarkListQueryDto } from '@app/catalog/bookmarks/dtos/bookmark-query.dto';
import { UserBookmarksResultDto } from '@app/catalog/bookmarks/dtos/bookmark-response.dto';

@ApiTags('Profile / Bookmarks')
@ApiBearerAuth()
@Controller('catalog/profile/bookmarks')
export class ProfileBookmarksController {
  constructor(private readonly service: BookmarksService) {}

  @Get()
  @ApiOperation({ summary: 'List current user bookmarks (Load more)' })
  @ApiOkResponse({ type: UserBookmarksResultDto })
  async listMine(
    @Query() q: BookmarkListQueryDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<UserBookmarksResultDto> {
    const userId = requireUserId(user);
    return this.service.listForUser(userId, q);
  }
}
