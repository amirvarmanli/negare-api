import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { requireUserId } from '@app/catalog/utils/current-user.util';
import { DownloadsService } from '@app/finance/downloads/downloads.service';
import {
  DownloadDecisionDto,
  QuotaStatusDto,
} from '@app/finance/downloads/dto/download-response.dto';
import { DownloadTokensService } from '@app/finance/downloads/download-tokens.service';
import { Public } from '@app/common/decorators/public.decorator';
import { requestTraceStorage } from '@app/common/tracing/request-trace';
import type { Response } from 'express';
import type { Request } from 'express';

function sanitizeFilename(value: string): string {
  return value
    .replace(/[\r\n"]/gu, '')
    .replace(/[^\x20-\x7E]/gu, '_')
    .trim() || 'download';
}

function buildContentDisposition(filename: string): string {
  const safe = sanitizeFilename(filename);
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

@ApiTags('Finance / Downloads')
@ApiBearerAuth()
@Controller()
export class DownloadsController {
  constructor(
    private readonly downloadsService: DownloadsService,
    private readonly downloadTokens: DownloadTokensService,
  ) {}

  @Post('products/:id/download')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Gate and register a product download.' })
  @ApiOkResponse({ type: DownloadDecisionDto })
  @ApiForbiddenResponse({
    description:
      'سقف دانلود روزانه محصولات رایگان به پایان رسیده است. | برای دانلود نیاز به خرید محصول است. | برای دانلود نیاز به اشتراک فعال است.',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiNotFoundResponse({ description: 'فایل محصول یافت نشد.' })
  async download(
    @Param('id') productId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
    @Req() req: Request,
  ): Promise<DownloadDecisionDto> {
    const userId = requireUserId(user);
    return this.downloadsService.downloadProduct(
      userId,
      productId,
      buildDownloadMetadata(req),
    );
  }

  @Get('products/:id/download')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Download a product (canonical endpoint).' })
  @ApiOkResponse({ type: DownloadDecisionDto })
  @ApiForbiddenResponse({
    description:
      'سقف دانلود روزانه محصولات رایگان به پایان رسیده است. | برای دانلود نیاز به خرید محصول است. | برای دانلود نیاز به اشتراک فعال است.',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiNotFoundResponse({ description: 'فایل محصول یافت نشد.' })
  async downloadGet(
    @Param('id') productId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
    @Req() req: Request,
  ): Promise<DownloadDecisionDto> {
    const userId = requireUserId(user);
    return this.downloadsService.downloadProduct(
      userId,
      productId,
      buildDownloadMetadata(req),
    );
  }

  @Get('me/quotas/today')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get today quota usage.' })
  @ApiOkResponse({ type: QuotaStatusDto })
  async todayQuota(
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<QuotaStatusDto> {
    const userId = requireUserId(user);
    return this.downloadsService.getTodayQuota(userId);
  }

  @Get('downloads/files/:fileId')
  @Public()
  @ApiOperation({ summary: 'Download a purchased product file (token required).' })
  @ApiQuery({ name: 'token', required: true })
  @ApiOkResponse({ description: 'File download stream.' })
  async downloadFile(
    @Param('fileId') fileId: string,
    @Query('token') token: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!token) {
      throw new UnauthorizedException('Download token is required.');
    }
    const payload = this.downloadTokens.verifyToken(token);
    if (payload.fid !== fileId) {
      throw new UnauthorizedException('Download token mismatch.');
    }

    const download = await this.downloadsService.getOrderFileDownload({
      userId: payload.sub,
      orderId: payload.oid,
      fileId,
      metadata: buildDownloadMetadata(req),
    });

    const stream = download.stream;
    stream.once('error', (err) => {
      const code = (err as NodeJS.ErrnoException).code;
      if (!res.headersSent) {
        if (code === 'ENOENT') {
          res.status(404).json({ message: 'File not found.' });
        } else {
          res.status(500).json({ message: 'Download failed.' });
        }
      } else {
        res.end();
      }
    });

    res.setHeader(
      'Content-Disposition',
      buildContentDisposition(download.filename),
    );
    res.setHeader(
      'Content-Type',
      download.mimeType ?? 'application/octet-stream',
    );
    if (download.size !== undefined) {
      res.setHeader('Content-Length', String(download.size));
    }

    return new StreamableFile(stream);
  }
}

function buildDownloadMetadata(req: Request): {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
} {
  const traceId = requestTraceStorage.getStore()?.traceId ?? null;
  const requestId =
    traceId ||
    (typeof req.headers['x-request-id'] === 'string'
      ? req.headers['x-request-id']
      : null);
  return {
    ip: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
    requestId,
  };
}
