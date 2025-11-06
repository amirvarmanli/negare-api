import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ConflictException, GoneException } from '@nestjs/common';
import * as request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { UploadController } from '@app/core/upload/upload.controller';
import { UploadService } from '@app/core/upload/upload.service';
import { UploadGateway, EV_SERVER_PROGRESS, EV_UPLOADED } from '@app/core/upload/upload.gateway';
import {
  UPLOAD_CONFIG,
  UPLOAD_STATE_STORE,
  STORAGE_DRIVER,
  type UploadConfig,
} from '@app/core/upload/upload.tokens';
import { MediaService } from '@app/core/media/media.service';
import { InMemoryUploadStateStore, FakeStorageDriver, MockMediaService } from '@test/utils/upload-fakes';
import type { FileTypeResult } from 'file-type';

jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
  fileTypeFromFile: jest.fn(),
}));

const { fileTypeFromBuffer, fileTypeFromFile } = jest.requireMock('file-type') as {
  fileTypeFromBuffer: jest.MockedFunction<(...args: any[]) => Promise<FileTypeResult | undefined>>;
  fileTypeFromFile: jest.MockedFunction<(...args: any[]) => Promise<FileTypeResult | undefined>>;
};

describe('UploadModule E2E', () => {
  let app: INestApplication;
  let httpServer: any;
  let baseUrl: string;
  let tmpRoot: string;
  let store: InMemoryUploadStateStore;
  let storage: FakeStorageDriver;
  let media: MockMediaService;

  const allowedDetection = { mime: 'text/plain', ext: 'txt' } as FileTypeResult;
  const disallowedDetection = { mime: 'application/x-msdownload', ext: 'exe' } as FileTypeResult;

  beforeAll(async () => {
    tmpRoot = await fs.mkdtemp(join(tmpdir(), 'upload-e2e-'));
    store = new InMemoryUploadStateStore(false);
    storage = new FakeStorageDriver();
    media = new MockMediaService();

    const config: UploadConfig = {
      tmpDir: tmpRoot,
      chunkSize: 4,
      ttlSeconds: 60,
      maxSizeBytes: 10 * 1024,
      cdnBaseUrl: 'https://cdn.test',
      publicRoot: 'public',
      allowedExts: ['txt'],
      allowedMime: ['text/plain'],
      backend: 'ftp',
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        UploadService,
        UploadGateway,
        { provide: UPLOAD_CONFIG, useValue: config },
        { provide: UPLOAD_STATE_STORE, useValue: store },
        { provide: STORAGE_DRIVER, useValue: storage },
        { provide: MediaService, useValue: media },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.use((req: any, _res, next) => {
      const header = req.headers['x-user-id'];
      req.user = { id: typeof header === 'string' ? header : 'user-1' };
      next();
    });
    await app.init();
    await app.listen(0);
    httpServer = app.getHttpServer();
    const address = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  beforeEach(() => {
    store.clear();
    storage.uploaded.clear();
    storage.deleted = [];
    media.records.length = 0;
    media.fail = false;

    fileTypeFromBuffer.mockImplementation(async (buffer: Buffer) => {
      if (buffer.toString().includes('bad-chunk')) {
        return disallowedDetection;
      }
      return allowedDetection;
    });
    fileTypeFromFile.mockImplementation(async (path: string) => {
      const content = await fs.readFile(path, 'utf8');
      if (content.includes('bad-file')) {
        return disallowedDetection;
      }
      return allowedDetection;
    });
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  const createClient = async (uploadId: string): Promise<{ socket: Socket; progress: any[]; uploaded: Promise<any> }> => {
    const socket = io(`${baseUrl}/upload`, {
      transports: ['websocket'],
      forceNew: true,
    });
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    const progress: any[] = [];
    socket.emit('join', { uploadId });
    await new Promise<void>((resolve) => socket.on('joined', () => resolve()));
    socket.on(EV_SERVER_PROGRESS, (ev) => progress.push(ev));
    const uploaded = new Promise<any>((resolve) => socket.on(EV_UPLOADED, resolve));
    return { socket, progress, uploaded };
  };

  const initSession = async (size = 7) =>
    request(httpServer)
      .post('/upload/init')
      .set('x-user-id', 'user-1')
      .send({ filename: 'doc.txt', size, mime: 'text/plain' })
      .expect(200);

  it('completes full upload flow and emits websocket events', async () => {
    const initRes = await initSession();
    const { uploadId, chunkSize } = initRes.body.data;
    expect(chunkSize).toBe(4);

    const client = await createClient(uploadId);

    // send last chunk first (out of order) with idempotent retry
    await request(httpServer)
      .post('/upload/chunk')
      .query({ uploadId, index: 1 })
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('xyz'))
      .expect(200);

    await request(httpServer)
      .post('/upload/chunk')
      .query({ uploadId, index: 0 })
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('abcd'))
      .expect(200);

    await request(httpServer)
      .post('/upload/chunk')
      .query({ uploadId, index: 0 })
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('abcd'))
      .expect(200);

    const statusRes = await request(httpServer)
      .get('/upload/status')
      .query({ uploadId })
      .expect(200);
    expect(statusRes.body.data.percent).toBe(100);

    const finishRes = await request(httpServer)
      .post('/upload/finish')
      .send({ uploadId })
      .expect(200);
    expect(finishRes.body.data.url).toContain('https://cdn.test');
    expect(media.records).toHaveLength(1);

    const uploadedPayload = await client.uploaded;
    expect(uploadedPayload).toMatchObject({ uploadId, path: expect.stringContaining('uploads/') });
    client.socket.disconnect();

    expect(client.progress.some((ev) => ev.percent === 100)).toBe(true);
    const [storedPath] = Array.from(storage.uploaded.keys());
    expect(storedPath).toMatch(/uploads\//);
  });

  it('rejects chunk index out of range', async () => {
    const initRes = await initSession();
    const uploadId = initRes.body.data.uploadId;
    await request(httpServer)
      .post('/upload/chunk')
      .query({ uploadId, index: 5 })
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('abcd'))
      .expect(400);
  });

  it('rejects invalid chunk size with 422', async () => {
    const initRes = await initSession();
    const uploadId = initRes.body.data.uploadId;
    await request(httpServer)
      .post('/upload/chunk')
      .query({ uploadId, index: 0 })
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('too-long-chunk'))
      .expect(422);
  });

  it('rejects disallowed MIME on chunk detection', async () => {
    const initRes = await initSession();
    const uploadId = initRes.body.data.uploadId;
    await request(httpServer)
      .post('/upload/chunk')
      .query({ uploadId, index: 0 })
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('bad-chunk'))
      .expect(400);
  });

  it('rejects disallowed MIME on final file sniff', async () => {
    const initRes = await initSession();
    const uploadId = initRes.body.data.uploadId;
    await request(httpServer)
      .post('/upload/chunk')
      .query({ uploadId, index: 0 })
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('good'))
      .expect(200);
    await request(httpServer)
      .post('/upload/chunk')
      .query({ uploadId, index: 1 })
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('bad-file'))
      .expect(200);

    fileTypeFromFile.mockResolvedValueOnce(disallowedDetection);
    await request(httpServer)
      .post('/upload/finish')
      .send({ uploadId })
      .expect(400);
  });

  it('returns 410 for expired sessions', async () => {
    const initRes = await initSession();
    const uploadId = initRes.body.data.uploadId;
    const snapshot = store.peek(uploadId)!;
    await store.patchCAS(snapshot.uploadId, snapshot.version, {
      expiresAt: Date.now() - 1,
    });

    await request(httpServer)
      .get('/upload/status')
      .query({ uploadId })
      .expect(GoneException.prototype.getStatus());
  });

  it('rolls back when media persistence fails', async () => {
    const initRes = await initSession();
    const uploadId = initRes.body.data.uploadId;
    await request(httpServer)
      .post('/upload/chunk')
      .query({ uploadId, index: 0 })
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('abcd'))
      .expect(200);
    await request(httpServer)
      .post('/upload/chunk')
      .query({ uploadId, index: 1 })
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('efg'))
      .expect(200);

    media.fail = true;
    await request(httpServer)
      .post('/upload/finish')
      .send({ uploadId })
      .expect(500);
    expect(storage.deleted.length).toBeGreaterThanOrEqual(1);
  });

  it('returns 409 when concurrent writes clash', async () => {
    const initRes = await initSession(8);
    const uploadId = initRes.body.data.uploadId;
    const body = Buffer.from('abcd');

    const responses = await Promise.all([
      request(httpServer)
        .post('/upload/chunk')
        .query({ uploadId, index: 0 })
        .set('Content-Type', 'application/octet-stream')
        .send(body),
      request(httpServer)
        .post('/upload/chunk')
        .query({ uploadId, index: 0 })
        .set('Content-Type', 'application/octet-stream')
        .send(body),
    ]);

    const statuses = responses.map((r) => r.status);
    expect(statuses).toContain(200);
    expect(statuses).toContain(ConflictException.prototype.getStatus());
  });
});
