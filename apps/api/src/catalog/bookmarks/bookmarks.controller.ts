import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { requireUserId } from '@app/catalog/utils/current-user.util';
import { BookmarksService } from '@app/catalog/bookmarks/bookmarks.service';
import { BookmarkToggleResponseDto } from '@app/catalog/bookmarks/dtos/bookmark-toggle.dto';

@ApiTags('Catalog / Bookmarks')
@ApiBearerAuth()
@Controller('catalog/bookmarks')
export class BookmarksController {
  constructor(private readonly service: BookmarksService) {}

  @Post(':productId/toggle')
  @ApiOperation({ summary: 'Toggle bookmark for a product' })
  @ApiOkResponse({ type: BookmarkToggleResponseDto })
  async toggle(
    @Param('productId') productId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<BookmarkToggleResponseDto> {
    const userId = requireUserId(user);
    return this.service.toggle(userId, productId);
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remove bookmark explicitly' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(
    @Param('productId') productId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<void> {
    const userId = requireUserId(user);
    await this.service.remove(userId, productId);
  }

  @Get(':productId/check')
  @ApiOperation({ summary: 'Check if current user bookmarked the product' })
  @ApiOkResponse({
    schema: { properties: { bookmarked: { type: 'boolean' } } },
  })
  async check(
    @Param('productId') productId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ) {
    const userId = requireUserId(user);
    return this.service.isBookmarked(userId, productId);
  }
}
