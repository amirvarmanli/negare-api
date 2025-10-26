import {
  Controller,
  Param,
  Post,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Readable } from 'node:stream';
import { DownloadsService } from './downloads.service';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '@app/common/decorators/current-user.decorator';

@ApiTags('Catalog Downloads')
@Controller('catalog/products')
export class DownloadsController {
  constructor(private readonly downloadsService: DownloadsService) {}

  @Post(':id/download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth('refresh_token')
  @ApiOperation({
    summary: 'Register product download',
    description:
      'Validates entitlement, enforces daily caps, records analytics, and increments product download counters.',
  })
  @ApiResponse({
    status: 200,
    description: 'Binary product download stream.',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 403, description: 'Entitlement requirements not satisfied.' })
  @ApiResponse({ status: 404, description: 'Product or file not found.' })
  @ApiResponse({ status: 429, description: 'Daily download limit reached.' })
  @ApiResponse({ status: 500, description: 'Unexpected server error.' })
  async download(
    @Param('id') productId: string,
    @CurrentUser() currentUser: CurrentUserPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const result = await this.downloadsService.downloadProduct(
      productId,
      currentUser?.id,
    );

    const dispositionName = result.filename ?? `product-${productId}`;
    if (result.mimeType) {
      res.setHeader('Content-Type', result.mimeType);
    }
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(dispositionName)}"`,
    );
    res.setHeader('X-Product-Downloads-Count', String(result.downloadsCount));
    if (result.size !== undefined) {
      res.setHeader('Content-Length', String(result.size));
    }

    return new StreamableFile(result.stream as Readable);
  }
}

