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
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
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
  QuotaStatusDto,
  DownloadLimitsSummaryDto,
} from '@app/finance/downloads/dto/download-response.dto';
import { DownloadTokensService } from '@app/finance/downloads/download-tokens.service';
import { Public } from '@app/common/decorators/public.decorator';
import { requestTraceStorage } from '@app/common/tracing/request-trace';
import type { Readable } from 'node:stream';
import type { Response } from 'express';
import type { Request } from 'express';
import { buildContentDisposition } from '@app/finance/downloads/downloads.utils';

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
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({ description: 'File download stream.' })
  @ApiForbiddenResponse({
    description: 'SUBSCRIPTION_REQUIRED | برای دانلود نیاز به خرید محصول است.',
  })
  @ApiTooManyRequestsResponse({ description: 'DAILY_QUOTA_EXCEEDED' })
  @ApiUnauthorizedResponse({ description: 'NOT_AUTHENTICATED' })
  @ApiNotFoundResponse({ description: 'فایل محصول یافت نشد.' })
  async download(
    @Param('id') productId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const userId = requireUserId(user);
    const download = await this.downloadsService.downloadProductStream(
      userId,
      productId,
      buildDownloadMetadata(req),
    );
    return streamDownload(res, download);
  }

  @Get('products/:id/download')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Download a product (canonical endpoint).' })
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({ description: 'File download stream.' })
  @ApiForbiddenResponse({
    description: 'SUBSCRIPTION_REQUIRED | برای دانلود نیاز به خرید محصول است.',
  })
  @ApiTooManyRequestsResponse({ description: 'DAILY_QUOTA_EXCEEDED' })
  @ApiUnauthorizedResponse({ description: 'NOT_AUTHENTICATED' })
  @ApiNotFoundResponse({ description: 'فایل محصول یافت نشد.' })
  async downloadGet(
    @Param('id') productId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const userId = requireUserId(user);
    const download = await this.downloadsService.downloadProductStream(
      userId,
      productId,
      buildDownloadMetadata(req),
    );
    return streamDownload(res, download);
  }

  @Post('downloads/:fileId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Gate and register a product file download.' })
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({ description: 'File download stream.' })
  @ApiForbiddenResponse({
    description: 'SUBSCRIPTION_REQUIRED | برای دانلود نیاز به خرید محصول است.',
  })
  @ApiTooManyRequestsResponse({ description: 'DAILY_QUOTA_EXCEEDED' })
  @ApiUnauthorizedResponse({ description: 'NOT_AUTHENTICATED' })
  @ApiNotFoundResponse({ description: 'File not found.' })
  async downloadFileGate(
    @Param('fileId') fileId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const userId = requireUserId(user);
    const download = await this.downloadsService.downloadFileStream(
      userId,
      fileId,
      buildDownloadMetadata(req),
    );
    return streamDownload(res, download);
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

  @Get('me/quotas/summary')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get daily download limits and remaining quotas.',
  })
  @ApiOkResponse({ type: DownloadLimitsSummaryDto })
  @ApiUnauthorizedResponse({ description: 'NOT_AUTHENTICATED' })
  async downloadLimitsSummary(
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<DownloadLimitsSummaryDto> {
    const userId = requireUserId(user);
    return this.downloadsService.getDownloadLimitsSummary(userId);
  }

  @Get('downloads/files/:fileId')
  @Public()
  @ApiOperation({ summary: 'Download a purchased product file (token required).' })
  @ApiQuery({ name: 'token', required: true })
  @ApiOkResponse({ description: 'File download stream.' })
  async downloadFileStream(
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
    res.setHeader('Content-Type', download.mimeType ?? 'application/octet-stream');
    if (download.size !== undefined) {
      res.setHeader('Content-Length', String(download.size));
    }
    exposeDownloadHeaders(res);

    return new StreamableFile(stream);
  }
}

function streamDownload(
  res: Response,
  download: { stream: Readable; filename: string; mimeType?: string; size?: number },
): StreamableFile {
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

  res.setHeader('Content-Disposition', buildContentDisposition(download.filename));
  res.setHeader('Content-Type', download.mimeType ?? 'application/octet-stream');
  if (download.size !== undefined) {
    res.setHeader('Content-Length', String(download.size));
  }
  exposeDownloadHeaders(res);

  return new StreamableFile(stream);
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

function exposeDownloadHeaders(res: Response): void {
  const expose = ['Content-Disposition', 'Content-Type', 'Content-Length'];
  const existing = res.getHeader('Access-Control-Expose-Headers');
  if (!existing) {
    res.setHeader('Access-Control-Expose-Headers', expose.join(', '));
    return;
  }

  const existingValues = Array.isArray(existing)
    ? existing.join(', ')
    : String(existing);
  const merged = new Set(
    existingValues
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  for (const header of expose) merged.add(header);
  res.setHeader('Access-Control-Expose-Headers', Array.from(merged).join(', '));
}
