// apps/api/src/core/upload/upload.controller.ts
import {
  BadRequestException,
  Controller,
  Post,
  Query,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Get,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { UploadService } from '@app/core/upload/upload.service';

import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiGoneResponse,
  ApiPayloadTooLargeResponse,
  ApiInternalServerErrorResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { UploadInitDto } from '@app/core/upload/dto/upload-init.dto';
import { UploadFinishDto } from '@app/core/upload/dto/upload-finish.dto';
import { UploadSessionActionDto } from '@app/core/upload/dto/upload-session-action.dto';
import { Public } from '@app/common/decorators/public.decorator';

type RequestWithUser = Request & { user?: { id?: string } };

/** خواندن امن بدنه‌ی باینری بدون تکیه بر body-parser */
async function readRawBody(req: Request): Promise<Buffer> {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const onData = (c: Buffer) => chunks.push(c);
    const onEnd = () => {
      cleanup();
      resolve();
    };
    const onError = (e: unknown) => {
      cleanup();
      reject(e);
    };
    const onAborted = () => {
      cleanup();
      reject(new BadRequestException('request aborted by client'));
    };
    const cleanup = () => {
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
      req.off('aborted', onAborted);
    };

    req.on('data', onData);
    req.once('end', onEnd);
    req.once('error', onError);
    req.once('aborted', onAborted);
  });
  return Buffer.concat(chunks);
}

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly upload: UploadService) {}

  @Post('init')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start upload session',
    description:
      'Create an upload session and receive session id, chunk size, and expiration.',
  })
  @ApiConsumes('application/json')
  @ApiProduces('application/json')
  @ApiBody({ type: UploadInitDto })
  @ApiOkResponse({
    description: 'Upload session created',
    schema: {
      example: {
        success: true,
        data: {
          uploadId: 'b1f8e7a0-7e2d-4c3f-8f2b-0f1e9f8a1c2d',
          chunkSize: 1048576,
          totalChunks: 5,
          expiresAt: 1730712345123,
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiPayloadTooLargeResponse({ description: 'File too large' })
  @ApiInternalServerErrorResponse({
    description: 'Failed to create temp file',
  })
  async init(@Body() dto: UploadInitDto, @Req() req: RequestWithUser) {
    const userId = req.user?.id ?? 'public-anonymous'; // ← اجازه به مهمان
    const out = await this.upload.init(dto, userId);
    return { success: true, data: out };
  }

  @Post('chunk')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upload a chunk',
    description: 'Send a single binary chunk for the given upload session.',
  })
  @ApiQuery({ name: 'uploadId', required: true, type: String })
  @ApiQuery({ name: 'index', required: true, type: Number })
  @ApiQuery({
    name: 'sha256',
    required: false,
    type: String,
    description:
      'Optional chunk SHA-256 (hex). Required when integrity.chunkHash=required.',
  })
  @ApiConsumes('application/octet-stream')
  @ApiProduces('application/json')
  @ApiBody({
    description: 'Raw bytes of the chunk (application/octet-stream)',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiOkResponse({
    description: 'Chunk accepted',
    schema: {
      example: {
        success: true,
        data: { receivedBytes: 1048576, percent: 25, receivedIndex: 0 },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid query or chunk payload' })
  @ApiConflictResponse({ description: 'Upload session not writable' })
  @ApiGoneResponse({ description: 'Upload session expired' })
  @ApiUnprocessableEntityResponse({
    description: 'Invalid chunk length for given index',
  })
  @ApiInternalServerErrorResponse({ description: 'Failed to write chunk' })
  async chunk(
    @Req() req: Request,
    @Res() res: Response,
    @Query('uploadId') uploadId?: string,
    @Query('index', ParseIntPipe) index?: number,
    @Query('sha256') chunkSha?: string,
  ) {
    if (!uploadId || typeof index !== 'number' || index < 0) {
      throw new BadRequestException('uploadId & index are required');
    }

    const ct = (req.headers['content-type'] || '').toLowerCase();
    if (!ct.startsWith('application/octet-stream')) {
      throw new BadRequestException(
        'Content-Type must be application/octet-stream',
      );
    }

    const contentLengthHeader = req.headers['content-length'];
    const declaredLen =
      typeof contentLengthHeader === 'string'
        ? Number(contentLengthHeader)
        : undefined;

    const buf = await readRawBody(req);
    if (buf.length === 0) {
      throw new BadRequestException('empty chunk body');
    }
    if (
      declaredLen !== undefined &&
      Number.isFinite(declaredLen) &&
      declaredLen !== buf.length
    ) {
      this.logger.warn(
        `[upload/chunk] content-length mismatch: declared=${declaredLen} actual=${buf.length}`,
      );
      // فقط لاگ می‌گیریم؛ صحت سایز chunk در سرویس چک می‌شود
    }

    const out = await this.upload.writeChunk(uploadId, index, buf, chunkSha);
    return res.json({ success: true, data: out });
  }

  @Get('status')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get upload status',
    description:
      'Fetch current upload status for resuming or polling progress.',
  })
  @ApiQuery({ name: 'uploadId', required: true, type: String })
  @ApiProduces('application/json')
  @ApiOkResponse({
    description: 'Current status',
  })
  @ApiBadRequestResponse({ description: 'uploadId is required' })
  @ApiGoneResponse({ description: 'Upload session expired' })
  async status(@Query('uploadId') uploadId?: string) {
    if (!uploadId) throw new BadRequestException('uploadId is required');
    const out = await this.upload.getStatus(uploadId);
    return { success: true, data: out };
  }

  @Post('finish')
  @Public()
  @ApiOperation({
    summary: 'Finalize upload',
    description:
      'Moves the assembled file to storage and returns the public URL.',
  })
  @ApiConsumes('application/json')
  @ApiProduces('application/json')
  @ApiBody({ type: UploadFinishDto })
  @ApiOkResponse({
    description: 'Upload finalized',
  })
  @ApiBadRequestResponse({ description: 'Invalid uploadId or state' })
  @ApiConflictResponse({
    description: 'Upload already finished or invalid state',
  })
  @ApiGoneResponse({ description: 'Upload session expired' })
  @ApiInternalServerErrorResponse({
    description: 'Remote upload or persistence failed',
  })
  async finish(@Body() body: UploadFinishDto) {
    const out = await this.upload.finish(
      body.uploadId,
      body.subdir ?? 'uploads',
      body.sha256,
    );
    return { success: true, data: out };
  }

  @Post('pause')
  @Public()
  @ApiOperation({
    summary: 'Pause upload session',
    description:
      'Marks the session as paused; existing chunks remain intact for resume.',
  })
  @ApiBody({ type: UploadSessionActionDto })
  @ApiOkResponse({ description: 'Upload paused' })
  @ApiBadRequestResponse({ description: 'uploadId is missing or invalid' })
  @ApiConflictResponse({ description: 'Upload cannot be paused in current state' })
  async pause(@Body() body: UploadSessionActionDto) {
    const out = await this.upload.pause(body.uploadId);
    return { success: true, data: out };
  }

  @Post('resume')
  @Public()
  @ApiOperation({
    summary: 'Resume paused upload session',
    description: 'Allows chunk uploads again by flipping the session to receiving.',
  })
  @ApiBody({ type: UploadSessionActionDto })
  @ApiOkResponse({ description: 'Upload resumed' })
  @ApiBadRequestResponse({ description: 'uploadId is missing or invalid' })
  @ApiConflictResponse({ description: 'Upload is not paused' })
  async resume(@Body() body: UploadSessionActionDto) {
    const out = await this.upload.resume(body.uploadId);
    return { success: true, data: out };
  }

  @Post('abort')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Abort upload session',
    description: 'Cancels the session and removes temp file and stored state.',
  })
  @ApiQuery({ name: 'uploadId', required: true, type: String })
  @ApiProduces('application/json')
  @ApiOkResponse({
    schema: {
      example: { success: true, data: { aborted: true, uploadId: '...' } },
    },
  })
  @ApiBadRequestResponse({ description: 'uploadId is required or not found' })
  async abort(@Query('uploadId') uploadId?: string) {
    if (!uploadId) throw new BadRequestException('uploadId is required');
    const out = await this.upload.abort(uploadId);
    return { success: true, data: out };
  }
}
