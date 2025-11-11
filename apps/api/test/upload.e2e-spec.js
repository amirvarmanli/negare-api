"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_os_1 = require("node:os");
const testing_1 = require("@nestjs/testing");
const common_1 = require("@nestjs/common");
const request = __importStar(require("supertest"));
const socket_io_client_1 = require("socket.io-client");
const upload_controller_1 = require("@app/core/upload/upload.controller");
const upload_service_1 = require("@app/core/upload/upload.service");
const upload_gateway_1 = require("@app/core/upload/upload.gateway");
const upload_tokens_1 = require("@app/core/upload/upload.tokens");
const media_service_1 = require("@app/core/media/media.service");
const upload_fakes_1 = require("@test/utils/upload-fakes");
jest.mock('file-type', () => ({
    fileTypeFromBuffer: jest.fn(),
    fileTypeFromFile: jest.fn(),
}));
const { fileTypeFromBuffer, fileTypeFromFile } = jest.requireMock('file-type');
describe('UploadModule E2E', () => {
    let app;
    let httpServer;
    let baseUrl;
    let tmpRoot;
    let store;
    let storage;
    let media;
    const allowedDetection = { mime: 'text/plain', ext: 'txt' };
    const disallowedDetection = { mime: 'application/x-msdownload', ext: 'exe' };
    beforeAll(async () => {
        tmpRoot = await node_fs_1.promises.mkdtemp((0, node_path_1.join)((0, node_os_1.tmpdir)(), 'upload-e2e-'));
        store = new upload_fakes_1.InMemoryUploadStateStore(false);
        storage = new upload_fakes_1.FakeStorageDriver();
        media = new upload_fakes_1.MockMediaService();
        const config = {
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
        const moduleRef = await testing_1.Test.createTestingModule({
            controllers: [upload_controller_1.UploadController],
            providers: [
                upload_service_1.UploadService,
                upload_gateway_1.UploadGateway,
                { provide: upload_tokens_1.UPLOAD_CONFIG, useValue: config },
                { provide: upload_tokens_1.UPLOAD_STATE_STORE, useValue: store },
                { provide: upload_tokens_1.STORAGE_DRIVER, useValue: storage },
                { provide: media_service_1.MediaService, useValue: media },
            ],
        }).compile();
        app = moduleRef.createNestApplication();
        app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
        app.use((req, _res, next) => {
            const header = req.headers['x-user-id'];
            req.user = { id: typeof header === 'string' ? header : 'user-1' };
            next();
        });
        await app.init();
        await app.listen(0);
        httpServer = app.getHttpServer();
        const address = httpServer.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
    });
    afterAll(async () => {
        await app.close();
        await node_fs_1.promises.rm(tmpRoot, { recursive: true, force: true });
    });
    beforeEach(() => {
        store.clear();
        storage.uploaded.clear();
        storage.deleted = [];
        media.records.length = 0;
        media.fail = false;
        fileTypeFromBuffer.mockImplementation(async (buffer) => {
            if (buffer.toString().includes('bad-chunk')) {
                return disallowedDetection;
            }
            return allowedDetection;
        });
        fileTypeFromFile.mockImplementation(async (path) => {
            const content = await node_fs_1.promises.readFile(path, 'utf8');
            if (content.includes('bad-file')) {
                return disallowedDetection;
            }
            return allowedDetection;
        });
    });
    afterEach(async () => {
        jest.clearAllMocks();
    });
    const createClient = async (uploadId) => {
        const socket = (0, socket_io_client_1.io)(`${baseUrl}/upload`, {
            transports: ['websocket'],
            forceNew: true,
        });
        await new Promise((resolve) => socket.on('connect', () => resolve()));
        const progress = [];
        socket.emit('join', { uploadId });
        await new Promise((resolve) => socket.on('joined', () => resolve()));
        socket.on(upload_gateway_1.EV_SERVER_PROGRESS, (ev) => progress.push(ev));
        const uploaded = new Promise((resolve) => socket.on(upload_gateway_1.EV_UPLOADED, resolve));
        return { socket, progress, uploaded };
    };
    const initSession = async (size = 7) => request(httpServer)
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
        const snapshot = store.peek(uploadId);
        await store.patchCAS(snapshot.uploadId, snapshot.version, {
            expiresAt: Date.now() - 1,
        });
        await request(httpServer)
            .get('/upload/status')
            .query({ uploadId })
            .expect(common_1.GoneException.prototype.getStatus());
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
        expect(statuses).toContain(common_1.ConflictException.prototype.getStatus());
    });
});
