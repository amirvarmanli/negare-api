import { Controller, Post, Param } from '@nestjs/common';
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
import { LikeToggleResponseDto } from '@app/catalog/likes/dtos/like-toggle.dto';

@ApiTags('Catalog / Likes')
@ApiBearerAuth()
@Controller('catalog/likes')
export class LikesController {
  constructor(private readonly service: LikesService) {}

  @Post(':productId/toggle')
  @ApiOperation({ summary: 'Toggle like on a product (like/unlike)' })
  @ApiOkResponse({ type: LikeToggleResponseDto })
  async toggle(
    @Param('productId') productId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<LikeToggleResponseDto> {
    const userId = requireUserId(user);
    return this.service.toggle(userId, productId);
  }
}
