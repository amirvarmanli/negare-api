// apps/api/src/core/upload/upload.service.ts
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Inject,
  ConflictException,
  GoneException,
  Logger,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { fileTypeFromBuffer, fileTypeFromFile } from 'file-type';
import { requestTraceStorage } from '@app/common/tracing/request-trace';

import {
  type UploadInitInput,
  type UploadInitOutput,
  type UploadChunkResult,
  type UploadStatus,
  type UploadFinishResult,
  type StorageDriver,
  type UploadStateStore,
  type MimeType,
  type UploadId,
  type UserId,
  type IntegrityMode,
} from '@app/core/upload/upload.types';
import {
  UPLOAD_CONFIG,
  UPLOAD_STATE_STORE,
  STORAGE_DRIVER,
  type UploadConfig,
} from '@app/core/upload/upload.tokens';
import { UploadGateway } from '@app/core/upload/upload.gateway';
import { MediaService } from '@app/core/media/media.service';

/** ---------- Branded-cast helpers ---------- */
const asUploadId = (s: string) => s as unknown as UploadId;
const asUserId = (s: string) => s as unknown as UserId;
const asMimeType = (s: string) => s as unknown as MimeType;

type UploadProgress = {
  sentBytes: number;
  totalBytes?: number;
};

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/x-matroska': 'mkv',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/vnd.rar': 'rar',
};

const EXTENSION_NORMALIZATION_MAP: Record<string, string> = {
  mvk: 'mkv',
};

/** ---------- Store feature guards (type-safe) ---------- */
type StoreWithLock = UploadStateStore & {
  withLock: (
    id: UploadId,
    ttlMs: number,
    fn: () => Promise<any>,
  ) => Promise<any>;
};
type StoreWithTouch = UploadStateStore & {
  touch: (id: UploadId, ttlSec: number) => Promise<void>;
};
type StoreWithCAS = UploadStateStore & {
  patchCAS: (
    id: UploadId,
    version: number,
    patch: Partial<UploadStatus>,
  ) => Promise<boolean>;
};

function hasWithLock(s: UploadStateStore): s is StoreWithLock {
  return typeof (s as any).withLock === 'function';
}
function hasTouch(s: UploadStateStore): s is StoreWithTouch {
  return typeof (s as any).touch === 'function';
}
function hasCAS(s: UploadStateStore): s is StoreWithCAS {
  return typeof (s as any).patchCAS === 'function';
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    @Inject(UPLOAD_CONFIG) private readonly cfg: UploadConfig,
    @Inject(UPLOAD_STATE_STORE) private readonly store: UploadStateStore,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly gateway: UploadGateway,
    private readonly media: MediaService,
  ) {}

  // ----------------------------------------------------
  // Public API
  // ----------------------------------------------------

  /** Initialize a new upload session. */
  async init(
    input: UploadInitInput,
    userId: string,
  ): Promise<UploadInitOutput> {
    const { filename, size } = input;
    const declaredSha = this.normalizeSha256(input.sha256 ?? undefined);

    // --- MIME normalize + alias map ---
    const rawMime = (input.mime ?? 'application/octet-stream')
      .trim()
      .toLowerCase();
    const aliasMap: Record<string, string> = {
      'application/x-zip-compressed': 'application/zip',
      'application/x-zip': 'application/zip',
      'multipart/x-zip': 'application/zip',
      'application/x-rar-compressed': 'application/vnd.rar',
    };
    const mimeNormalized = (aliasMap[rawMime] ?? rawMime) as MimeType;

    if (!userId) throw new BadRequestException('userId is required');
    if (!filename || typeof filename !== 'string') {
      throw new BadRequestException('filename is required');
    }
    if (!size || size <= 0 || !Number.isFinite(size)) {
      throw new BadRequestException('size must be a positive number');
    }
    if (this.cfg.maxSizeBytes && size > this.cfg.maxSizeBytes) {
      throw new PayloadTooLargeException('file is too large');
    }
    if (!this.isAllowedExt(filename)) {
      throw new BadRequestException('file extension is not allowed');
    }

    // اگر MIME ورودی octet-stream بود (یا کلاینت چیزی درست نداد)،
    // در init سخت‌گیری نکن؛ تصمیم نهایی با sniff در writeChunk(0)/finish
    const isOctet = mimeNormalized === ('application/octet-stream' as MimeType);
    if (!isOctet && !this.isAllowedMime(mimeNormalized)) {
      throw new BadRequestException('MIME type is not allowed');
    }

    const uploadId = randomUUID();
    const tmpRoot = this.cfg.tmpDir;
    const tempPath = join(tmpRoot, `${uploadId}.part`);

    // create sparse temp file with target size
    try {
      await fs.mkdir(tmpRoot, { recursive: true });
      const fh = await fs.open(tempPath, 'w');
      await fh.truncate(size);
      await fh.close();
    } catch {
      throw new InternalServerErrorException('failed to create temp file');
    }

    const now = Date.now();
    const expiresAt = now + this.cfg.ttlSeconds * 1000;
    const chunkSize = this.cfg.chunkSize;
    const totalChunks = Math.ceil(size / chunkSize);

    const status: UploadStatus = {
      uploadId: asUploadId(uploadId),
      userId: asUserId(userId),
      filename,
      mime: asMimeType(mimeNormalized),
      size,
      chunkSize,
      totalChunks,
      receivedBytes: 0,
      receivedIndexes: [],
      state: 'init',
      createdAt: now,
      expiresAt,
      tempPath,
      remoteRelativePath: undefined,
      version: 1,
      sha256: declaredSha,
      chunkHashes: {},
    };

    await this.store.create(status, this.cfg.ttlSeconds);
    return { uploadId: status.uploadId, chunkSize, totalChunks, expiresAt };
  }

  /** Write a chunk at index (offset = index * chunkSize). */
  async writeChunk(
    uploadId: string,
    index: number,
    chunk: Buffer,
    chunkHash?: string | null,
  ): Promise<UploadChunkResult> {
    if (!uploadId) throw new BadRequestException('uploadId is required');
    if (!Number.isInteger(index) || index < 0) {
      throw new BadRequestException('index must be a non-negative integer');
    }
    if (!chunk || chunk.length === 0) {
      throw new BadRequestException('empty chunk');
    }

    const normalizedHash = this.normalizeSha256(chunkHash ?? undefined);
    const chunkMode = this.getIntegrityMode('chunkHash');
    if (chunkMode === 'required' && !normalizedHash) {
      throw new BadRequestException('chunk sha256 is required');
    }

    const run = async () => {
      const s = await this.mustGetActive(uploadId);
      s.chunkHashes = s.chunkHashes ?? {};

      // Not writable states
      if (
        s.state === 'uploaded' ||
        s.state === 'ready-to-upload' ||
        s.state === 'uploading' ||
        s.state === 'error'
      ) {
        throw new ConflictException('upload session is not writable');
      }
      if (s.state === 'paused') {
        throw new ConflictException('upload session is paused');
      }

      // Transition init → receiving
      if (s.state === 'init') {
        await this.patchAndSync(s, uploadId, { state: 'receiving' });
      }

      // Index bounds
      if (index >= s.totalChunks) {
        throw new BadRequestException('chunk index out of range');
      }

      // Strict chunk length (except last chunk)
      this.assertChunkLength(index, chunk, s);

      const offset = index * s.chunkSize;
      const actualHash = this.hashBuffer(chunk);
      if (normalizedHash && actualHash !== normalizedHash) {
        throw new BadRequestException('chunk sha256 mismatch');
      }

      // First-chunk MIME sniff (defense-in-depth)
      if (index === 0) {
        try {
          const ft = await fileTypeFromBuffer(chunk);
          const detected = ft?.mime?.toLowerCase();
          if (detected && !this.isAllowedMime(detected)) {
            await this.safeRemoveTemp(s.tempPath);
            await this.store.delete(asUploadId(uploadId));
            throw new BadRequestException(
              `detected MIME not allowed: ${detected}`,
            );
          }
          if (detected && detected !== String(s.mime)) {
            await this.patchAndSync(s, uploadId, {
              mime: asMimeType(detected),
            });
          }
        } catch {
          /* ignore */
        }
      }

      // Idempotency: skip rewrite if already present
      const already = s.receivedIndexes.includes(index);
      if (!already) {
        try {
          const fh = await fs.open(s.tempPath!, 'r+');
          try {
            await fh.write(chunk, 0, chunk.length, offset);
          } finally {
            await fh.close();
          }
        } catch {
          throw new InternalServerErrorException('failed to write chunk');
        }
      }
      const ensureHash = async () => {
        if (already) {
          const existing =
            s.chunkHashes?.[index] ??
            (await this.hydrateChunkHash(s, uploadId, index, offset, chunk.length));
          if (existing && existing !== actualHash) {
            throw new ConflictException(
              `chunk ${index} does not match stored content`,
            );
          }
          return undefined;
        }
        return actualHash;
      };
      const hashPatch = await ensureHash();

      const receivedIndexes = already
        ? s.receivedIndexes
        : [...s.receivedIndexes, index].sort((a, b) => a - b);
      const receivedBytes = this.computeReceivedBytes(s, receivedIndexes);

      await this.patchAndSync(s, uploadId, {
        receivedBytes,
        receivedIndexes,
        ...(hashPatch ? { chunkHashes: { [index]: hashPatch } } : {}),
      });

      await this.touchUpload(uploadId);

      const percent = this.computePercent(receivedBytes, s.size);
      return { receivedBytes, percent, receivedIndex: index };
    };

    return this.withStoreLock(uploadId, run);
  }

  /** Read current status (safe for client resume). */
  async getStatus(uploadId: string) {
    const s = await this.mustGetActive(uploadId);
    return this.buildStatusPayload(s);
  }

  /** Finalize the upload (guarded by a lock + strict transitions). */
  async finish(
    uploadId: string,
    subdir = 'uploads',
    sha256Hint?: string | null,
  ): Promise<UploadFinishResult & { id: string }> {
    if (!uploadId) throw new BadRequestException('uploadId is required');
    const normalizedFinishSha = this.normalizeSha256(sha256Hint ?? undefined);

    const run = async () => {
      const s = await this.mustGetActive(uploadId);
      const storedSha = s.sha256 ? s.sha256.toLowerCase() : undefined;
      if (storedSha && normalizedFinishSha && storedSha !== normalizedFinishSha) {
        throw new BadRequestException('sha256 mismatch between init and finish');
      }
      const expectedFinalSha = normalizedFinishSha ?? storedSha;
      const fileIntegrityMode = this.getIntegrityMode('fileHash');
      if (fileIntegrityMode === 'required' && !expectedFinalSha) {
        throw new BadRequestException('final sha256 is required by server');
      }

      // completeness
      this.assertAllChunksReceived(s);
      if (!s.tempPath)
        throw new InternalServerErrorException('temp file not found');

      // Forbid invalid transitions
      if (s.state === 'uploaded')
        throw new ConflictException('upload already finished');
      if (
        s.state !== 'receiving' &&
        s.state !== 'ready-to-upload' &&
        s.state !== 'paused'
      ) {
        throw new ConflictException(`invalid state for finish: ${s.state}`);
      }

      const shouldComputeSha =
        fileIntegrityMode !== 'off' || typeof expectedFinalSha === 'string';
      let computedSha: string | undefined;
      if (shouldComputeSha) {
        computedSha = await this.computeFileSha(s.tempPath);
        if (expectedFinalSha && computedSha !== expectedFinalSha) {
          this.logger.warn(
            `sha256 mismatch | uploadId=${uploadId} expected=${expectedFinalSha} actual=${computedSha}`,
          );
          await this.safeRemoveTemp(s.tempPath);
          await this.store.delete(asUploadId(uploadId)).catch((): void => {});
          throw new BadRequestException(
            'final file sha256 mismatch; please re-upload',
          );
        }
      }
      const finalSha = computedSha ?? expectedFinalSha;

      // Whole-file MIME sniff
      let detectedMime: string | undefined;
      try {
        const ft = await fileTypeFromFile(s.tempPath).catch((): undefined => undefined);
        const sniffed = ft?.mime?.toLowerCase();
        if (sniffed && !this.isAllowedMime(sniffed)) {
          await this.safeRemoveTemp(s.tempPath);
          await this.store.delete(asUploadId(uploadId));
          throw new BadRequestException(`detected MIME not allowed: ${sniffed}`);
        }
        detectedMime = sniffed ?? undefined;
      } catch {
        /* ignore */
      }

      const finalMime = (detectedMime ?? String(s.mime)).toLowerCase();
      const finalMimeType = asMimeType(finalMime);
      if (finalMime !== String(s.mime)) {
        await this.patchAndSync(s, uploadId, { mime: finalMimeType });
      }

      const extMap = MIME_EXTENSION_MAP;
      const targetExt = extMap[finalMime];
      const originalSafe = this.safeName(s.filename);
      const baseName = originalSafe.replace(/\.[^.]+$/, '');
      const finalSafeName = targetExt ? `${baseName}.${targetExt}` : originalSafe;

      const dateDir = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const publicSubdir = this.normalizeOptionalSegment(this.cfg.publicSubdir);
      const baseDir = this.normalizeSubdir(
        this.cfg.baseDir ?? subdir ?? 'uploads',
      );
      const dirSegments = [publicSubdir, baseDir, dateDir].filter(Boolean);
      const relativeDir = dirSegments.join('/');
      const relativePath = `${relativeDir}/${randomUUID()}-${finalSafeName}`;
      const remoteDir = relativeDir;
      const traceId = requestTraceStorage.getStore()?.traceId ?? 'n/a';
      const userId = String(s.userId);
      const keepTempOnError = Boolean(this.cfg.keepTempOnError);
      const maxAttempts = Math.max(1, this.cfg.retry?.retries ?? 3);
      const baseDelayMs = Math.max(100, this.cfg.retry?.minDelayMs ?? 800);

      await this.patchAndSync(s, uploadId, {
        state: 'ready-to-upload',
        remoteRelativePath: relativePath,
      });

      let uploadSucceeded = false;
      const uploadStartedAt = Date.now();

      // Upload to remote with progress
      try {
        await this.assertTempReady(s.tempPath, s.size);
        this.logger.log(
          `Remote upload start | traceId=${traceId} userId=${userId} uploadId=${uploadId} local=${s.tempPath} remote=${relativePath} size=${s.size}`,
        );

        if (remoteDir) {
          await this.ensureRemoteDir(remoteDir);
        }
        await this.patchAndSync(s, uploadId, { state: 'uploading' });

        const progressState = { lastEmitAt: 0, lastPercent: -1 };
        await this.uploadWithRetry(
          async (lp, rp, cb) => {
            progressState.lastEmitAt = 0;
            progressState.lastPercent = -1;
            await this.storage.uploadFile(lp, rp, cb);
          },
          s.tempPath,
          relativePath,
          (p) => {
            const now = Date.now();
            const total = p.totalBytes ?? s.size;
            const percentFromProgress =
              total > 0
                ? Math.min(100, Math.floor((p.sentBytes / total) * 100))
                : 0;
            const percent = percentFromProgress >= 0 ? percentFromProgress : 0;
            const shouldEmit =
              percent >= progressState.lastPercent + 1 ||
              now - progressState.lastEmitAt >= 100;

            if (shouldEmit) {
              progressState.lastEmitAt = now;
              progressState.lastPercent = percent;
              this.gateway.emitServerProgress({
                uploadId,
                sent: p.sentBytes,
                total,
                percent,
              });
            }
          },
          maxAttempts,
          baseDelayMs,
          `traceId=${traceId} userId=${userId} uploadId=${uploadId}`,
        );

        // guarantee 100% progress event
        this.gateway.emitServerProgress({
          uploadId,
          sent: s.size,
          total: s.size,
          percent: 100,
        });
        uploadSucceeded = true;
        const durationMs = Date.now() - uploadStartedAt;
        this.logger.log(
          `Remote upload OK | traceId=${traceId} userId=${userId} uploadId=${uploadId} remote=${relativePath} size=${s.size} durationMs=${durationMs}`,
        );
      } catch (err) {
        const durationMs = Date.now() - uploadStartedAt;
        await this.patchAndSync(s, uploadId, { state: 'error' });
        if (!keepTempOnError) {
          await this.safeRemoveTemp(s.tempPath);
        }
        const msg =
          err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        this.logger.error(
          `Remote upload FAILED | traceId=${traceId} userId=${userId} uploadId=${uploadId} local=${s.tempPath} remote=${relativePath} durationMs=${durationMs} :: ${msg}`,
          err instanceof Error ? err.stack : undefined,
        );
        throw new InternalServerErrorException(
          process.env.NODE_ENV === 'development'
            ? `remote upload failed: ${msg}`
            : 'remote upload failed',
          { cause: err instanceof Error ? err : undefined },
        );
      } finally {
        if (uploadSucceeded || !keepTempOnError) {
          await this.safeRemoveTemp(s.tempPath);
        }
      }

      const shaForResult = finalSha ?? storedSha;
      await this.patchAndSync(s, uploadId, {
        state: 'uploaded',
        ...(shaForResult ? { sha256: shaForResult } : {}),
      });

      const url = this.buildPublicUrl(relativePath);
      this.logger.log(
        `Upload stored | traceId=${traceId} userId=${userId} uploadId=${uploadId} docroot=${this.cfg.publicRoot} remote=${relativePath} url=${url}`,
      );

      // Persist DB record; on failure, try delete remote & flag error
      let savedId = '';
      try {
        const saved = await this.media.createFile({
          userId: String(s.userId),
          filename: s.filename,
          mime: String(s.mime),
          size: BigInt(s.size),
          path: relativePath,
          url,
          status: 'uploaded',
        });
        savedId = saved.id;
      } catch {
        if (typeof this.storage.delete === 'function') {
          try {
            await this.storage.delete(relativePath);
          } catch {
            /* ignore delete failure */
          }
        }
        await this.patchAndSync(s, uploadId, { state: 'error' });
        throw new InternalServerErrorException('failed to persist file record');
      } finally {
        await this.store.delete(asUploadId(uploadId)).catch((): void => {});
      }

      this.gateway.emitUploaded({ uploadId, url, path: relativePath });

      // توجه: UploadFinishResult شما ظاهراً الان شامل mime و size هم هست
      return {
        url,
        path: relativePath,
        id: savedId,
        mime: s.mime,
        size: s.size,
        sha256: shaForResult,
      };
    };

    return this.withStoreLock(uploadId, run);
  }

  async pause(uploadId: string) {
    if (!uploadId) throw new BadRequestException('uploadId is required');
    const run = async () => {
      const s = await this.mustGetActive(uploadId);
      if (s.state === 'uploaded' || s.state === 'uploading') {
        throw new ConflictException('cannot pause a finished upload');
      }
      if (s.state === 'ready-to-upload') {
        throw new ConflictException('upload is finalizing; cannot pause');
      }
      if (s.state === 'paused') {
        return this.buildStatusPayload(s);
      }
      await this.patchAndSync(s, uploadId, {
        state: 'paused',
        pausedAt: Date.now(),
      });
      await this.touchUpload(uploadId);
      return this.buildStatusPayload(s);
    };
    return this.withStoreLock(uploadId, run);
  }

  async resume(uploadId: string) {
    if (!uploadId) throw new BadRequestException('uploadId is required');
    const run = async () => {
      const s = await this.mustGetActive(uploadId);
      if (s.state !== 'paused') {
        throw new ConflictException('upload is not paused');
      }
      await this.patchAndSync(s, uploadId, {
        state: s.receivedIndexes.length ? 'receiving' : 'init',
        pausedAt: undefined,
      });
      await this.touchUpload(uploadId);
      return this.buildStatusPayload(s);
    };
    return this.withStoreLock(uploadId, run);
  }

  /** Abort an upload session: remove temp file + delete state. */
  async abort(uploadId: string) {
    if (!uploadId) throw new BadRequestException('uploadId is required');

    const s = await this.store.get(asUploadId(uploadId));
    if (!s) throw new BadRequestException('upload session not found');

    await this.safeRemoveTemp(s.tempPath);
    await this.store.delete(asUploadId(uploadId));

    return { aborted: true, uploadId };
  }

  // ----------------------------------------------------
  // Internals
  // ----------------------------------------------------

  private computeChunkLength(index: number, s: UploadStatus): number {
    const isLast = index === s.totalChunks - 1;
    if (!isLast) return s.chunkSize;
    const priorBytes = s.chunkSize * Math.max(0, s.totalChunks - 1);
    const remaining = s.size - priorBytes;
    return remaining > 0 ? remaining : s.chunkSize;
  }

  private computeReceivedBytes(
    s: UploadStatus,
    indexes: number[] = s.receivedIndexes,
  ): number {
    return indexes.reduce((acc, idx) => acc + this.computeChunkLength(idx, s), 0);
  }

  private computePercent(bytes: number, total: number): number {
    if (total <= 0) return 0;
    return Math.min(100, Math.max(0, Math.floor((bytes / total) * 100)));
  }

  private computeMissingIndexes(s: UploadStatus): number[] {
    const have = new Set(s.receivedIndexes);
    const missing: number[] = [];
    for (let i = 0; i < s.totalChunks; i++) {
      if (!have.has(i)) missing.push(i);
    }
    return missing;
  }

  private buildStatusPayload(s: UploadStatus) {
    const receivedBytes = this.computeReceivedBytes(s);
    const percent = this.computePercent(receivedBytes, s.size);
    return {
      uploadId: s.uploadId,
      userId: s.userId,
      filename: s.filename,
      mime: s.mime,
      size: s.size,
      chunkSize: s.chunkSize,
      totalChunks: s.totalChunks,
      receivedBytes,
      receivedIndexes: [...s.receivedIndexes],
      state: s.state,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      remoteRelativePath: s.remoteRelativePath,
      sha256: s.sha256,
      percent,
      missingIndexes: this.computeMissingIndexes(s),
    };
  }

  private normalizeSha256(value?: string | null): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/i.test(trimmed)) {
      throw new BadRequestException('sha256 must be 64-length hex string');
    }
    return trimmed;
  }

  private getIntegrityMode(kind: 'chunkHash' | 'fileHash'): IntegrityMode {
    return this.cfg.integrity?.[kind] ?? 'off';
  }

  private hashBuffer(buf: Buffer): string {
    return createHash('sha256').update(buf).digest('hex');
  }

  private async readChunkHashFromDisk(
    tempPath: string,
    offset: number,
    length: number,
  ): Promise<string> {
    const fh = await fs.open(tempPath, 'r');
    try {
      const buf = Buffer.alloc(length);
      await fh.read(buf, 0, length, offset);
      return this.hashBuffer(buf);
    } finally {
      await fh.close();
    }
  }

  private async hydrateChunkHash(
    snapshot: UploadStatus,
    uploadId: string,
    index: number,
    offset: number,
    length: number,
  ): Promise<string | undefined> {
    if (!snapshot.tempPath) return undefined;
    try {
      const hash = await this.readChunkHashFromDisk(
        snapshot.tempPath,
        offset,
        length,
      );
      await this.patchAndSync(snapshot, uploadId, {
        chunkHashes: { [index]: hash },
      });
      return hash;
    } catch {
      return undefined;
    }
  }

  private normalizeExt(ext?: string | null): string | null {
    if (!ext) return null;
    const lower = ext.toLowerCase();
    return EXTENSION_NORMALIZATION_MAP[lower] ?? lower;
  }

  private async computeFileSha(path: string): Promise<string> {
    const fh = await fs.open(path, 'r');
    try {
      const hash = createHash('sha256');
      const buffer = Buffer.alloc(1024 * 512);
      let offset = 0;
      while (true) {
        const { bytesRead } = await fh.read(buffer, 0, buffer.length, offset);
        if (bytesRead <= 0) break;
        offset += bytesRead;
        hash.update(buffer.subarray(0, bytesRead));
      }
      this.logger.debug(
        `Computed SHA-256 over ${offset} bytes for ${path}`,
      );
      return hash.digest('hex');
    } finally {
      await fh.close();
    }
  }

  private async touchUpload(uploadId: string): Promise<void> {
    if (hasTouch(this.store)) {
      try {
        await this.store.touch(asUploadId(uploadId), this.cfg.ttlSeconds);
      } catch {
        /* ignore */
      }
    }
  }

  /** Load active session and check TTL. */
  private async mustGetActive(uploadId: string): Promise<UploadStatus> {
    const s = await this.store.get(asUploadId(uploadId));
    if (!s) throw new BadRequestException('upload session not found');
    this.assertNotExpired(s);
    return s;
  }

  /** Ensure session not expired; if expired, cleanup and throw. */
  private assertNotExpired(s: UploadStatus) {
    if (Date.now() > s.expiresAt) {
      this.safeRemoveTemp(s.tempPath).catch((): void => {});
      this.store.delete(s.uploadId).catch((): void => {});
      throw new GoneException('upload session expired');
    }
  }

  /** Validate chunk length (exact size; last chunk may be smaller). */
  private assertChunkLength(index: number, buf: Buffer, s: UploadStatus) {
    const offset = index * s.chunkSize;
    const isLast = index === s.totalChunks - 1;
    const expected = isLast ? s.size - offset : s.chunkSize;
    if (buf.length !== expected) {
      throw new UnprocessableEntityException(
        `invalid chunk length at index ${index}`,
      );
    }
  }

  /** Ensure a complete contiguous set of chunk indexes [0..total-1]. */
  private assertAllChunksReceived(s: UploadStatus) {
    if (s.receivedIndexes.length !== s.totalChunks) {
      throw new BadRequestException('file is incomplete (missing chunks)');
    }
    for (let i = 0; i < s.totalChunks; i++) {
      if (s.receivedIndexes[i] !== i) {
        throw new BadRequestException(`missing chunk index ${i}`);
      }
    }
  }

  /** Sanitize filename for remote path safety; collapse multiple dots + NFC normalize. */
  private safeName(name: string): string {
    const normalized = name.normalize('NFC');
    const policy = this.cfg.filenamePolicy;
    const replaceWith = policy?.replaceWith ?? '_';
    const cleaned = normalized.replace(/[^a-zA-Z0-9_.-]/g, replaceWith);
    const tokens = cleaned.split('.');
    const ext = tokens.length > 1 ? (tokens.pop() ?? '') : '';
    const baseTokens = tokens.length > 0 ? tokens : ['file'];
    let base = baseTokens.join('_');
    const maxLen = policy?.maxNameLength ?? 100;
    if (base.length > maxLen) {
      base = base.slice(0, maxLen);
    }
    if (!base) base = 'file';
    return ext ? `${base}.${ext}` : base;
  }

  /** Build public URL from CDN base + relative path. */
  private buildPublicUrl(relativePath: string): string {
    const base = (this.cfg.cdnBaseUrl || '').replace(/\/+$/, '');
    return `${base}/${relativePath}`;
  }

  /** Normalize subdir to avoid path traversal and duplicated slashes. */
  private normalizeSubdir(input: string): string {
    const segments = this.sanitizePathSegments(input ?? '');
    return segments.length > 0 ? segments.join('/') : 'uploads';
  }

  /** Normalize optional path segment; returns '' when omitted. */
  private normalizeOptionalSegment(input?: string): string {
    const segments = this.sanitizePathSegments(input ?? '');
    return segments.join('/');
  }

  private sanitizePathSegments(input: string): string[] {
    return input
      .replace(/\\/g, '/')
      .split('/')
      .map((segment) => segment.trim())
      .filter((segment) => segment && segment !== '.' && segment !== '..');
  }

  /** Ensure remote directory exists if the storage driver supports it. */
  private async ensureRemoteDir(relativeDir: string): Promise<void> {
    if (typeof this.storage.ensureDir === 'function') {
      await this.storage.ensureDir(relativeDir);
    }
  }

  /** Extension allowlist. */
  private isAllowedExt(filename: string): boolean {
    const list = (this.cfg.allowedExts ?? []).map((s) => s.toLowerCase());
    if (list.length === 0) return true;
    const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/i);
    const ext = this.normalizeExt(m?.[1]);
    return !!ext && list.includes(ext);
  }

  /** MIME allowlist. */
  private isAllowedMime(mime?: string | null): boolean {
    const list = (this.cfg.allowedMime ?? []).map((s) => s.toLowerCase());
    if (list.length === 0) return true;
    return !!mime && list.includes(mime.toLowerCase());
  }

  /** Safe temp cleanup. */
  private async safeRemoveTemp(path?: string | null) {
    if (!path) return;
    try {
      await fs.rm(path, { force: true });
    } catch {
      /* ignore */
    }
  }

  private async assertTempReady(
    localPath: string,
    expectedSize: number,
  ): Promise<void> {
    const stat = await fs.stat(localPath).catch((): never => {
      throw new InternalServerErrorException(`temp file missing: ${localPath}`);
    });
    if (!stat.isFile()) {
      throw new InternalServerErrorException(`temp not a file: ${localPath}`);
    }
    if (expectedSize > 0 && stat.size !== expectedSize) {
      throw new InternalServerErrorException(
        `temp size mismatch: got=${stat.size} expected=${expectedSize}`,
      );
    }
  }

  private isTransient(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return /ECONN|ETIMEDOUT|EPIPE|ENOTFOUND|ECONNRESET|Timeout/i.test(msg);
  }

  private async uploadWithRetry(
    fn: (
      local: string,
      remote: string,
      onProgress: (p: UploadProgress) => void,
    ) => Promise<void>,
    localPath: string,
    remotePath: string,
    onProgress: (p: UploadProgress) => void,
    attempts = 3,
    baseDelayMs = 800,
    context = '',
  ): Promise<void> {
    let lastErr: unknown;
    for (let i = 1; i <= attempts; i++) {
      try {
        await fn(localPath, remotePath, onProgress);
        return;
      } catch (err) {
        lastErr = err;
        if (!this.isTransient(err) || i === attempts) {
          break;
        }
        const backoff = baseDelayMs * 2 ** (i - 1);
        const prefix = context ? `${context} | ` : '';
        this.logger.warn(
          `${prefix}remote upload attempt ${i} failed; retrying in ${backoff}ms…`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
    throw lastErr;
  }

  /** Patch with CAS if supported, else merge (under lock). */
  private async patch(
    uploadId: string,
    expectedVersion: number,
    patch: Partial<UploadStatus>,
  ): Promise<number> {
    const id = asUploadId(uploadId);

    // اگر CAS پشتیبانی می‌شود، همان مسیر
    if (hasCAS(this.store)) {
      const ok = await this.store.patchCAS(id, expectedVersion, patch);
      if (!ok) throw new ConflictException('upload state changed; retry');
      return expectedVersion + 1;
    }

    // ⬇️ از اینجا به بعد به‌جای this.store، از baseStore (با تایپ صریح) استفاده کن
    const baseStore: UploadStateStore = this.store;

    // fallback: بدون CAS؛ زیر لاک بیرونی merge کن
    const cur = await baseStore.get(id);
    if (!cur) throw new BadRequestException('upload session not found');

    const merged: UploadStatus = {
      ...cur,
      ...patch,
      version: expectedVersion + 1,
      receivedIndexes: patch.receivedIndexes
        ? Array.from(
            new Set([...cur.receivedIndexes, ...patch.receivedIndexes]),
          ).sort((a, b) => a - b)
        : cur.receivedIndexes,
      receivedBytes:
        typeof patch.receivedBytes === 'number'
          ? Math.max(cur.receivedBytes ?? 0, patch.receivedBytes)
          : (cur.receivedBytes ?? 0),
      expiresAt: patch.expiresAt ?? cur.expiresAt,
      chunkHashes: patch.chunkHashes
        ? {
            ...(cur.chunkHashes ?? {}),
            ...patch.chunkHashes,
          }
        : cur.chunkHashes ?? {},
    };

    try {
      await baseStore.delete(id);
    } catch {
      /* ignore delete errors in fallback */
    }
    await baseStore.create(merged, this.cfg.ttlSeconds);

    return merged.version;
  }

  /** Apply patch and update the in-memory snapshot. */
  private async patchAndSync(
    snapshot: UploadStatus,
    uploadId: string,
    patch: Partial<UploadStatus>,
  ): Promise<void> {
    const nextVersion = await this.patch(uploadId, snapshot.version, patch);
    snapshot.version = nextVersion;
    if (patch.state) snapshot.state = patch.state;
    if (patch.receivedBytes !== undefined) {
      snapshot.receivedBytes = patch.receivedBytes;
    }
    if (patch.receivedIndexes) {
      snapshot.receivedIndexes = [...patch.receivedIndexes];
    }
    if (patch.remoteRelativePath !== undefined) {
      snapshot.remoteRelativePath = patch.remoteRelativePath;
    }
    if (patch.mime) snapshot.mime = patch.mime;
    if (patch.size) snapshot.size = patch.size;
    if (patch.chunkHashes) {
      snapshot.chunkHashes = {
        ...(snapshot.chunkHashes ?? {}),
        ...patch.chunkHashes,
      };
    }
    if (patch.pausedAt !== undefined) {
      snapshot.pausedAt = patch.pausedAt;
    }
    if (patch.sha256 !== undefined) {
      snapshot.sha256 = patch.sha256;
    }
  }

  /** Guarded execution with store lock if available */
  private async withStoreLock<T>(
    uploadId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    if (hasWithLock(this.store)) {
      const desired = this.cfg.ttlSeconds * 1000;
      const lockTtl = Math.min(Math.max(15_000, desired), 120_000);
      return this.store.withLock(asUploadId(uploadId), lockTtl, work);
    }
    return work();
  }
}
