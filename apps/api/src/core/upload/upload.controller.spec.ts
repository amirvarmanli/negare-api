import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ConflictException } from '@nestjs/common';
import * as request from 'supertest';
import { UploadController } from '@app/core/upload/upload.controller';
import { UploadService } from '@app/core/upload/upload.service';

describe('UploadController', () => {
  let app: INestApplication;
  const uploadService = {
    init: jest.fn(),
    writeChunk: jest.fn(),
    getStatus: jest.fn(),
    finish: jest.fn(),
    abort: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [{ provide: UploadService, useValue: uploadService }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: any, _res, next) => {
      const hdr = req.headers['x-user-id'];
      if (typeof hdr === 'string') {
        req.user = { id: hdr };
      }
      next();
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('initializes upload session for authenticated user', async () => {
    uploadService.init.mockResolvedValue({
      uploadId: 'abc',
      chunkSize: 1024,
      totalChunks: 4,
      expiresAt: Date.now() + 1000,
    });

    const res = await request(app.getHttpServer())
      .post('/upload/init')
      .set('x-user-id', 'user-1')
      .send({ filename: 'file.txt', size: 2048, mime: 'text/plain' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(uploadService.init).toHaveBeenCalledWith(
      { filename: 'file.txt', size: 2048, mime: 'text/plain' },
      'user-1',
    );
  });

  it('rejects init without user context', async () => {
    const res = await request(app.getHttpServer())
      .post('/upload/init')
      .send({ filename: 'file.txt', size: 2048 })
      .expect(400);
    expect(res.body.message).toContain('userId is required');
  });

  it('uploads chunk with binary body', async () => {
    uploadService.writeChunk.mockResolvedValue({
      receivedBytes: 512,
      percent: 50,
      receivedIndex: 0,
    });

    const res = await request(app.getHttpServer())
      .post('/upload/chunk')
      .query({ uploadId: 'abc', index: 0 })
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('abcd'))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(uploadService.writeChunk).toHaveBeenCalledWith('abc', 0, expect.any(Buffer));
  });

  it('rejects chunk with wrong content-type', async () => {
    await request(app.getHttpServer())
      .post('/upload/chunk')
      .query({ uploadId: 'abc', index: 0 })
      .set('Content-Type', 'text/plain')
      .send('plain')
      .expect(400);
  });

  it('returns status payload', async () => {
    uploadService.getStatus.mockResolvedValue({
      uploadId: 'abc',
      filename: 'file.txt',
      mime: 'text/plain',
      size: 2048,
      chunkSize: 1024,
      totalChunks: 2,
      receivedBytes: 1024,
      receivedIndexes: [0],
      state: 'receiving',
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000,
      percent: 50,
    });

    const res = await request(app.getHttpServer())
      .get('/upload/status')
      .query({ uploadId: 'abc' })
      .expect(200);

    expect(res.body.data.percent).toBe(50);
    expect(uploadService.getStatus).toHaveBeenCalledWith('abc');
  });

  it('finalizes upload and returns payload', async () => {
    uploadService.finish.mockResolvedValue({
      url: 'https://cdn/file',
      path: 'uploads/file',
      id: 'media-1',
      mime: 'text/plain',
      size: 2048,
    });

    const res = await request(app.getHttpServer())
      .post('/upload/finish')
      .send({ uploadId: 'abc', subdir: 'uploads' })
      .expect(200);

    expect(res.body.data.id).toBe('media-1');
    expect(uploadService.finish).toHaveBeenCalledWith('abc', 'uploads');
  });

  it('propagates service errors with correct status code', async () => {
    uploadService.finish.mockRejectedValue(new ConflictException('bad state'));

    const res = await request(app.getHttpServer())
      .post('/upload/finish')
      .send({ uploadId: 'abc' })
      .expect(409);
    expect(res.body.message).toContain('bad state');
  });

  it('aborts upload session', async () => {
    uploadService.abort.mockResolvedValue({ aborted: true, uploadId: 'abc' });

    const res = await request(app.getHttpServer())
      .post('/upload/abort')
      .query({ uploadId: 'abc' })
      .expect(200);

    expect(res.body.data.aborted).toBe(true);
    expect(uploadService.abort).toHaveBeenCalledWith('abc');
  });
});
