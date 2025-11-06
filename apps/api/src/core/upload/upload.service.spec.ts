import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as crypto from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  GoneException,
  InternalServerErrorException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { FileTypeResult } from 'file-type';
import { UploadService } from './upload.service';
import type { UploadConfig } from './upload.tokens';
import { InMemoryUploadStateStore, FakeStorageDriver, MockMediaService } from '@test/utils/upload-fakes';
import type { UploadGateway } from './upload.gateway';

jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
  fileTypeFromFile: jest.fn(),
}));

const { fileTypeFromBuffer, fileTypeFromFile } = jest.requireMock('file-type') as {
  fileTypeFromBuffer: jest.MockedFunction<(...args: any[]) => Promise<FileTypeResult | undefined>>;
  fileTypeFromFile: jest.MockedFunction<(...args: any[]) => Promise<FileTypeResult | undefined>>;
};

describe('UploadService', () => {
  let tmpRoot: string;
  let config: UploadConfig;
  let store: InMemoryUploadStateStore;
  let storage: FakeStorageDriver;
  let media: MockMediaService;
  let gateway: { emitServerProgress: jest.Mock; emitUploaded: jest.Mock };
  let service: UploadService;
  type ServiceInternals = {
    assertTempReady: (localPath: string, expectedSize: number) => Promise<void>;
    uploadWithRetry: (
      fn: (
        local: string,
        remote: string,
        onProgress: (p: { sentBytes: number; totalBytes?: number }) => void,
      ) => Promise<void>,
      localPath: string,
      remotePath: string,
      onProgress: (p: { sentBytes: number; totalBytes?: number }) => void,
      attempts?: number,
      baseDelayMs?: number,
      context?: string,
    ) => Promise<void>;
  };
  const internals = () => service as unknown as ServiceInternals;

  const allowedDetection = { mime: 'text/plain', ext: 'txt' } as FileTypeResult;
  const disallowedDetection = { mime: 'application/x-msdownload', ext: 'exe' } as FileTypeResult;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(join(tmpdir(), 'upload-service-'));
    config = {
      tmpDir: tmpRoot,
      chunkSize: 4,
      ttlSeconds: 120,
      maxSizeBytes: 1024,
      cdnBaseUrl: 'https://cdn.test',
      publicRoot: 'public',
      publicSubdir: '',
      baseDir: 'uploads',
      allowedExts: ['txt', 'bin', 'png', 'webp'],
      allowedMime: [
        'text/plain',
        'application/octet-stream',
        'image/png',
        'image/webp',
      ],
      backend: 'ftp',
    };
    store = new InMemoryUploadStateStore();
    storage = new FakeStorageDriver();
    media = new MockMediaService();
    gateway = {
      emitServerProgress: jest.fn(),
      emitUploaded: jest.fn(),
    };
    service = new UploadService(
      config,
      store,
      storage,
      gateway as unknown as UploadGateway,
      media as unknown as any,
    );

    jest.clearAllMocks();
    fileTypeFromBuffer.mockResolvedValue(allowedDetection);
    fileTypeFromFile.mockResolvedValue(allowedDetection);
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  const initSession = async (size = 6) =>
    service.init({ filename: 'sample.txt', size, mime: 'text/plain' }, 'user-1');

  it('assertTempReady validates existing temp file and size', async () => {
    const init = await initSession();
    const uploadId = String(init.uploadId);
    const status = store.peek(uploadId)!;

    await expect(
      internals().assertTempReady(status.tempPath, status.size),
    ).resolves.toBeUndefined();

    await expect(
      internals().assertTempReady(status.tempPath, status.size + 1),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    await fs.rm(status.tempPath);
    await expect(
      internals().assertTempReady(status.tempPath, status.size),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('uploadWithRetry retries transient errors and eventually succeeds', async () => {
    const attempt = jest
      .fn<
        Promise<void>,
        [
          string,
          string,
          (p: { sentBytes: number; totalBytes?: number }) => void,
        ]
      >()
      .mockRejectedValueOnce(new Error('ETIMEDOUT: connect timed out'))
      .mockRejectedValueOnce(new Error('ECONNRESET: remote reset'))
      .mockImplementation(async (_local, _remote, onProgress) => {
        onProgress({ sentBytes: 10, totalBytes: 10 });
      });
    const progress = jest.fn();

    await expect(
      internals().uploadWithRetry(
        attempt,
        '/tmp/local',
        'remote/path',
        progress,
        3,
        10,
        'test',
      ),
    ).resolves.toBeUndefined();
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({ sentBytes: 10 }),
    );
  });

  it('uploadWithRetry stops on non-transient errors', async () => {
    const attempt = jest
      .fn<
        Promise<void>,
        [
          string,
          string,
          (p: { sentBytes: number; totalBytes?: number }) => void,
        ]
      >()
      .mockRejectedValue(new Error('fatal failure'));

    await expect(
      internals().uploadWithRetry(
        attempt,
        '/tmp/local',
        'remote/path',
        jest.fn(),
        4,
        5,
      ),
    ).rejects.toThrow('fatal failure');
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('initializes upload session and preallocates file', async () => {
    const result = await initSession(8);

    expect(result.chunkSize).toBe(4);
    expect(result.totalChunks).toBe(2);

    const stored = store.peek(String(result.uploadId));
    expect(stored).toBeDefined();
    const stat = await fs.stat(join(tmpRoot, `${result.uploadId}.part`));
    expect(stat.size).toBe(8);
  });

  it('rejects oversize uploads with 413', async () => {
    await expect(
      service.init(
        { filename: 'big.bin', size: config.maxSizeBytes + 1, mime: 'application/octet-stream' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('rejects disallowed extensions and MIME types', async () => {
    await expect(
      service.init({ filename: 'malware.exe', size: 10, mime: 'application/octet-stream' }, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.init({ filename: 'ok.txt', size: 10, mime: 'application/pdf' }, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('writes chunks, tracks progress, and keeps idempotency', async () => {
    const init = await initSession();
    const uploadId = String(init.uploadId);
    const chunk0 = Buffer.from('abcd');
    const chunk1 = Buffer.from('ef');

    const first = await service.writeChunk(uploadId, 0, chunk0);
    expect(first.receivedBytes).toBe(4);
    expect(first.percent).toBe(50);

    const second = await service.writeChunk(uploadId, 1, chunk1);
    expect(second.percent).toBe(100);

    const replay = await service.writeChunk(uploadId, 1, chunk1);
    expect(replay.receivedBytes).toBe(second.receivedBytes);

    const status = store.peek(String(init.uploadId))!;
    expect(status.receivedIndexes).toEqual([0, 1]);
    const fileContent = await fs.readFile(status.tempPath);
    expect(fileContent.slice(0, 4).toString()).toBe('abcd');
    expect(fileContent.slice(4, 6).toString()).toBe('ef');
  });

  it('enforces exact chunk lengths', async () => {
    const init = await initSession();
    const uploadId = String(init.uploadId);
    await expect(
      service.writeChunk(uploadId, 0, Buffer.from('toolong')),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('blocks disallowed detected MIME on first chunk', async () => {
    fileTypeFromBuffer.mockResolvedValueOnce(disallowedDetection);
    const init = await initSession();
    const uploadId = String(init.uploadId);
    await expect(
      service.writeChunk(uploadId, 0, Buffer.from('abcd')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(store.peek(String(init.uploadId))).toBeUndefined();
  });

  it('throws conflict when concurrent writers race without lock', async () => {
    store = new InMemoryUploadStateStore(false);
    service = new UploadService(
      config,
      store,
      storage,
      gateway as unknown as UploadGateway,
      media as unknown as any,
    );
    fileTypeFromBuffer.mockResolvedValue(allowedDetection);

    const init = await initSession();
    const uploadId = String(init.uploadId);
    const chunk = Buffer.from('abcd');

    const [first, second] = await Promise.allSettled([
      service.writeChunk(uploadId, 0, chunk),
      service.writeChunk(uploadId, 0, chunk),
    ]);

    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('rejected');
    if (second.status === 'rejected') {
      expect(second.reason).toBeInstanceOf(ConflictException);
    }
  });

  it('returns sanitized status without tempPath', async () => {
    const init = await initSession();
    const uploadId = String(init.uploadId);
    await service.writeChunk(uploadId, 0, Buffer.from('abcd'));
    const status = await service.getStatus(uploadId);
    expect(status).not.toHaveProperty('tempPath');
    expect(status.percent).toBe(50);
  });

  it('throws GoneException when session expired', async () => {
    const init = await initSession();
    const uploadId = String(init.uploadId);
    const internal = store.peek(uploadId)!;
    await store.patchCAS(internal.uploadId, internal.version, {
      expiresAt: Date.now() - 10,
    });
    await expect(service.getStatus(uploadId)).rejects.toBeInstanceOf(GoneException);
  });

  it('finalizes upload, uploads to storage, and persists media record', async () => {
    const init = await initSession();
    const uploadId = String(init.uploadId);
    fileTypeFromBuffer.mockResolvedValue(allowedDetection);
    fileTypeFromFile.mockResolvedValue(allowedDetection);

    await service.writeChunk(uploadId, 0, Buffer.from('abcd'));
    await service.writeChunk(uploadId, 1, Buffer.from('ef'));

    const result = await service.finish(uploadId, 'uploads');

    expect(result.url).toContain('https://cdn.test');
    expect(result.path).toMatch(/^uploads\//);
    expect(result.id).toBeDefined();
    expect(gateway.emitUploaded).toHaveBeenCalledWith(
      expect.objectContaining({ uploadId: init.uploadId, url: result.url }),
    );
    expect(gateway.emitServerProgress).toHaveBeenCalledWith(
      expect.objectContaining({ percent: 100 }),
    );
    expect(media.records).toHaveLength(1);
  });

  it('builds relative path and URL using configured baseDir without public subdir', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-11-06T12:00:00Z'));
    const uuidSpy = jest.spyOn(crypto, 'randomUUID');
    uuidSpy.mockImplementationOnce(() => 'session-id');
    uuidSpy.mockReturnValue('file-uuid');

    try {
      const init = await initSession();
      const uploadId = String(init.uploadId);
      await service.writeChunk(uploadId, 0, Buffer.from('abcd'));
      await service.writeChunk(uploadId, 1, Buffer.from('ef'));

      const result = await service.finish(uploadId);

      expect(result.path).toBe('uploads/2025-11-06/file-uuid-sample.txt');
      expect(result.url).toBe(
        'https://cdn.test/uploads/2025-11-06/file-uuid-sample.txt',
      );
      expect(storage.ensuredDirs.has('uploads/2025-11-06')).toBe(true);
    } finally {
      uuidSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('includes publicSubdir when configured', async () => {
    config.publicSubdir = 'cdn';
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-11-06T12:00:00Z'));
    const uuidSpy = jest.spyOn(crypto, 'randomUUID');
    uuidSpy.mockImplementationOnce(() => 'session-id');
    uuidSpy.mockReturnValue('file-uuid');

    try {
      const init = await initSession();
      const uploadId = String(init.uploadId);
      await service.writeChunk(uploadId, 0, Buffer.from('abcd'));
      await service.writeChunk(uploadId, 1, Buffer.from('ef'));

      const result = await service.finish(uploadId);

      expect(result.path).toBe('cdn/uploads/2025-11-06/file-uuid-sample.txt');
      expect(result.url).toBe(
        'https://cdn.test/cdn/uploads/2025-11-06/file-uuid-sample.txt',
      );
      expect(storage.ensuredDirs.has('cdn/uploads/2025-11-06')).toBe(true);
    } finally {
      uuidSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('normalizes extension to detected MIME', async () => {
    fileTypeFromBuffer.mockResolvedValueOnce({
      mime: 'image/webp',
      ext: 'webp',
    } as FileTypeResult);
    fileTypeFromFile.mockResolvedValueOnce({
      mime: 'image/webp',
      ext: 'webp',
    } as FileTypeResult);

    const init = await service.init(
      { filename: 'picture.png', size: 6, mime: 'image/png' },
      'user-1',
    );
    const uploadId = String(init.uploadId);

    await service.writeChunk(uploadId, 0, Buffer.from('abcd'));
    await service.writeChunk(uploadId, 1, Buffer.from('ef'));

    const result = await service.finish(uploadId);

    expect(result.path.endsWith('.webp')).toBe(true);
    expect(result.url.endsWith('.webp')).toBe(true);
    expect(media.records[0]?.mime).toBe('image/webp');
    expect(storage.uploaded.keys().next().value.endsWith('.webp')).toBe(true);
  });

  it('logs stored remote path and public URL', async () => {
    const logSpy = jest.spyOn((service as any).logger, 'log');
    const init = await initSession();
    const uploadId = String(init.uploadId);

    await service.writeChunk(uploadId, 0, Buffer.from('abcd'));
    await service.writeChunk(uploadId, 1, Buffer.from('ef'));

    try {
      await service.finish(uploadId);
    } catch (err) {
      logSpy.mockRestore();
      throw err;
    }

    const messages = logSpy.mock.calls.map(([msg]) => String(msg));
    expect(
      messages.some(
        (msg) =>
          msg.includes('Upload stored') &&
          msg.includes('remote=') &&
          msg.includes('url=https://cdn.test/'),
      ),
    ).toBe(true);
    logSpy.mockRestore();
  });

  it('propagates storage failures, marks error state, and surfaces remote failure', async () => {
    const failingStorage = new FakeStorageDriver();
    jest
      .spyOn(failingStorage, 'uploadFile')
      .mockRejectedValue(new Error('ftp down'));
    storage = failingStorage;
    service = new UploadService(
      config,
      store,
      storage,
      gateway as unknown as UploadGateway,
      media as unknown as any,
    );

    const init = await initSession();
    const uploadId = String(init.uploadId);
    const statusBefore = store.peek(uploadId)!;
    await service.writeChunk(uploadId, 0, Buffer.from('abcd'));
    await service.writeChunk(uploadId, 1, Buffer.from('ef'));

    await expect(service.finish(uploadId)).rejects.toThrow(
      /remote upload failed/i,
    );
    const statusAfter = store.peek(uploadId);
    expect(statusAfter?.state).toBe('error');
    await expect(fs.stat(statusBefore.tempPath)).rejects.toThrow();
    expect(storage.uploaded.size).toBe(0);
  });

  it('attempts rollback when media persistence fails', async () => {
    media.fail = true;
    const init = await initSession();
    const uploadId = String(init.uploadId);
    await service.writeChunk(uploadId, 0, Buffer.from('abcd'));
    await service.writeChunk(uploadId, 1, Buffer.from('ef'));

    await expect(service.finish(uploadId)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(storage.deleted).toHaveLength(1);
  });

  it('keeps temp file when keepTempOnError is enabled', async () => {
    config.keepTempOnError = true;
    service = new UploadService(
      config,
      store,
      storage,
      gateway as unknown as UploadGateway,
      media as unknown as any,
    );

    const init = await initSession();
    const uploadId = String(init.uploadId);
    const statusBefore = store.peek(uploadId)!;
    const tempPath = statusBefore.tempPath;

    await service.writeChunk(uploadId, 0, Buffer.from('abcd'));
    await service.writeChunk(uploadId, 1, Buffer.from('ef'));

    jest
      .spyOn(storage, 'uploadFile')
      .mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.finish(uploadId)).rejects.toThrow(
      /remote upload failed/i,
    );

    await expect(fs.stat(tempPath)).resolves.toBeDefined();
  });

  it('aborts upload and removes temp file', async () => {
    const init = await initSession();
    const uploadId = String(init.uploadId);
    const statusBefore = store.peek(uploadId)!;
    expect(await fs.stat(statusBefore.tempPath)).toBeDefined();

    const result = await service.abort(uploadId);
    expect(result.aborted).toBe(true);
    await expect(fs.stat(statusBefore.tempPath)).rejects.toThrow();
    expect(store.peek(String(init.uploadId))).toBeUndefined();
  });
});
