import { Body, Controller, Param, Post } from '@nestjs/common';
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
import { DownloadStartDto } from '@app/catalog/downloads/dtos/download-start.dto';
import { DownloadCreatedDto } from '@app/catalog/downloads/dtos/download-response.dto';

@ApiTags('Catalog / Downloads')
@ApiBearerAuth()
@Controller('catalog/downloads')
export class DownloadsController {
  constructor(private readonly service: DownloadsService) {}

  @Post(':productId/start')
  @ApiOperation({
    summary: 'Register a download and return a URL if available',
  })
  @ApiOkResponse({ type: DownloadCreatedDto })
  async start(
    @Param('productId') productId: string,
    @Body() dto: DownloadStartDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<DownloadCreatedDto> {
    const userId = requireUserId(user);
    return this.service.start(userId, productId, dto);
  }
}
