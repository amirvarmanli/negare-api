"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const supertest_1 = __importDefault(require("supertest"));
const config_1 = require("@nestjs/config");
const auth_controller_1 = require("@app/core/auth/auth.controller");
const password_service_1 = require("@app/core/auth/password/password.service");
const refresh_service_1 = require("@app/core/auth/refresh.service");
const refresh_rate_limit_service_1 = require("@app/core/auth/refresh-rate-limit.service");
const session_service_1 = require("@app/core/auth/session/session.service");
const token_service_1 = require("@app/core/auth/token/token.service");
const users_service_1 = require("@app/core/users/users.service");
const transform_response_interceptor_1 = require("@app/common/interceptors/transform-response.interceptor");
const http_exception_filter_1 = require("@app/common/filters/http-exception.filter");
const prisma_constants_1 = require("@app/prisma/prisma.constants");
const fake_redis_1 = require("@test/utils/fake-redis");
const auth_constants_1 = require("@app/core/auth/auth.constants");
const jsonwebtoken_1 = require("jsonwebtoken");
const frontendOrigin = 'http://localhost:3000';
class ConfigServiceStub {
    overrides;
    constructor(overrides = {}) {
        this.overrides = overrides;
    }
    get(key) {
        if (key === 'auth') {
            return (this.overrides.auth ?? ConfigServiceStub.defaultAuth);
        }
        if (key in this.overrides) {
            return this.overrides[key];
        }
        return (ConfigServiceStub.defaults[key] ?? undefined);
    }
    static defaultAuth = {
        accessSecret: 'e2e-access-secret',
        accessExpires: '5m',
        refreshSecret: 'e2e-refresh-secret',
        refreshExpires: '7d',
        cookie: {
            sameSite: 'lax',
            secure: false,
            refreshPath: '/api/auth/refresh',
            accessPath: '/',
        },
    };
    static defaults = {
        GLOBAL_PREFIX: 'api',
        FRONTEND_URL: frontendOrigin,
        CORS_ORIGIN: frontendOrigin,
        corsOrigins: undefined,
        SESSION_TTL: '30d',
        REFRESH_RL_MAX: '100',
        REFRESH_RL_WINDOW: '10',
    };
}
class StubPasswordService {
    async login(identifier, password) {
        if (['negare_user', 'user@example.com'].includes(identifier) &&
            password === 'Password!1') {
            return { userId: 'user-1' };
        }
        throw new Error('Invalid credentials');
    }
}
const usersServiceStub = {
    ensureActiveWithRoles: jest.fn().mockImplementation(async (userId) => ({
        id: userId,
        username: 'negare_user',
        userRoles: [{ role: { name: prisma_constants_1.RoleName.USER } }],
    })),
};
const flushRedis = async (redis) => {
    const keys = await redis.keys('*');
    if (keys.length) {
        await redis.del(...keys);
    }
};
const extractCookie = (setCookie, name) => {
    const list = Array.isArray(setCookie)
        ? setCookie
        : setCookie
            ? [setCookie]
            : [];
    const target = list.find((entry) => entry.startsWith(`${name}=`));
    if (!target)
        return null;
    const token = target.split(';')[0]?.split('=').slice(1).join('=');
    return {
        raw: target,
        value: token,
    };
};
const login = async (server) => {
    const res = await (0, supertest_1.default)(server)
        .post('/api/auth/login')
        .set('Origin', frontendOrigin)
        .send({ identifier: 'negare_user', password: 'Password!1' })
        .expect(200);
    const cookie = extractCookie(res.headers['set-cookie'], 'refresh_token');
    if (!cookie) {
        throw new Error('refresh cookie missing');
    }
    return { res, cookie };
};
describe('Auth refresh endpoint (dev config)', () => {
    let app;
    let server;
    let redis;
    beforeAll(async () => {
        redis = (0, fake_redis_1.createFakeRedis)();
        const moduleFixture = await testing_1.Test.createTestingModule({
            controllers: [auth_controller_1.AuthController],
            providers: [
                token_service_1.TokenService,
                session_service_1.SessionService,
                refresh_service_1.RefreshService,
                refresh_rate_limit_service_1.RefreshRateLimitService,
                { provide: password_service_1.PasswordService, useClass: StubPasswordService },
                { provide: users_service_1.UsersService, useValue: usersServiceStub },
                { provide: config_1.ConfigService, useValue: new ConfigServiceStub() },
                { provide: 'REDIS', useValue: redis },
            ],
        }).compile();
        app = moduleFixture.createNestApplication();
        app.use((0, cookie_parser_1.default)());
        app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
        app.useGlobalInterceptors(new transform_response_interceptor_1.TransformResponseInterceptor());
        app.enableCors({ origin: frontendOrigin, credentials: true });
        app.setGlobalPrefix('api');
        await app.init();
        server = app.getHttpServer();
    });
    afterAll(async () => {
        await app.close();
    });
    beforeEach(async () => {
        await flushRedis(redis);
        usersServiceStub.ensureActiveWithRoles.mockClear();
    });
    it('login sets refresh cookie with expected flags and allow-list entry', async () => {
        const { res, cookie } = await login(server);
        expect(res.body.success).toBe(true);
        expect(cookie.raw).toContain('Path=/api/auth/refresh');
        expect(cookie.raw).toContain('SameSite=Lax');
        expect(cookie.raw).not.toMatch(/Secure/i);
        const keys = await redis.keys('auth:refresh:allow:*');
        expect(keys.length).toBe(1);
        expect(await redis.get(keys[0])).toContain('"userId":"user-1"');
    });
    it('refresh rotates cookie, deletes old allow-list key, and blacklists jti', async () => {
        const { cookie } = await login(server);
        const oldToken = cookie.value;
        const oldPayload = (0, jsonwebtoken_1.decode)(oldToken);
        const oldJti = oldPayload?.jti;
        expect(oldJti).toBeDefined();
        const refreshRes = await (0, supertest_1.default)(server)
            .post('/api/auth/refresh')
            .set('Origin', frontendOrigin)
            .set('Content-Type', 'application/json')
            .set('Cookie', cookie.raw)
            .send({})
            .expect(200);
        expect(refreshRes.body.success).toBe(true);
        expect(refreshRes.body.data.accessToken).toEqual(expect.any(String));
        const newCookie = extractCookie(refreshRes.headers['set-cookie'], 'refresh_token');
        expect(newCookie).not.toBeNull();
        expect(newCookie.value).not.toEqual(oldToken);
        expect(newCookie.raw).toContain('Path=/api/auth/refresh');
        expect(await redis.get((0, auth_constants_1.refreshAllowKey)(oldJti))).toBeNull();
        const blacklist = await redis.get(`auth:rbl:${oldJti}`);
        expect(blacklist).toBe('1');
        const newPayload = (0, jsonwebtoken_1.decode)(newCookie.value);
        expect(await redis.get((0, auth_constants_1.refreshAllowKey)(newPayload.jti))).toBeTruthy();
    });
    it('returns 401 when cookie is missing', async () => {
        const res = await (0, supertest_1.default)(server)
            .post('/api/auth/refresh')
            .set('Origin', frontendOrigin)
            .set('Content-Type', 'application/json')
            .send({})
            .expect(401);
        expect(res.body.message).toContain('No refresh cookie');
    });
    it('fails second refresh with the same cookie (concurrency)', async () => {
        const { cookie } = await login(server);
        await (0, supertest_1.default)(server)
            .post('/api/auth/refresh')
            .set('Origin', frontendOrigin)
            .set('Content-Type', 'application/json')
            .set('Cookie', cookie.raw)
            .send({})
            .expect(200);
        const res = await (0, supertest_1.default)(server)
            .post('/api/auth/refresh')
            .set('Origin', frontendOrigin)
            .set('Content-Type', 'application/json')
            .set('Cookie', cookie.raw)
            .send({})
            .expect(401);
        expect(res.body.message).toContain('Invalid or expired refresh token');
    });
    it('rejects malformed allow-list records', async () => {
        const { cookie } = await login(server);
        const payload = (0, jsonwebtoken_1.decode)(cookie.value);
        await redis.set((0, auth_constants_1.refreshAllowKey)(payload.jti), 'not-json');
        const res = await (0, supertest_1.default)(server)
            .post('/api/auth/refresh')
            .set('Origin', frontendOrigin)
            .set('Content-Type', 'application/json')
            .set('Cookie', cookie.raw)
            .send({})
            .expect(401);
        expect(res.body.message).toContain('Malformed refresh token state');
    });
    it('rejects session mismatches', async () => {
        const { cookie } = await login(server);
        const payload = (0, jsonwebtoken_1.decode)(cookie.value);
        await redis.set((0, auth_constants_1.refreshAllowKey)(payload.jti), JSON.stringify({ userId: 'user-1', sessionId: 'different' }));
        const res = await (0, supertest_1.default)(server)
            .post('/api/auth/refresh')
            .set('Origin', frontendOrigin)
            .set('Content-Type', 'application/json')
            .set('Cookie', cookie.raw)
            .send({})
            .expect(401);
        expect(res.body.message).toContain('session mismatch');
    });
    it('returns 403 when Origin does not match FRONTEND_URL', async () => {
        const { cookie } = await login(server);
        const res = await (0, supertest_1.default)(server)
            .post('/api/auth/refresh')
            .set('Origin', 'http://malicious.test')
            .set('Content-Type', 'application/json')
            .set('Cookie', cookie.raw)
            .send({})
            .expect(403);
        expect(res.body.message).toContain('Origin is not allowed');
    });
    it('returns 400 when Content-Type is not application/json', async () => {
        const { cookie } = await login(server);
        const res = await (0, supertest_1.default)(server)
            .post('/api/auth/refresh')
            .set('Origin', frontendOrigin)
            .set('Content-Type', 'text/plain')
            .set('Cookie', cookie.raw)
            .send('noop')
            .expect(400);
        expect(res.body.message).toContain('Content-Type must be application/json');
    });
});
describe('Auth refresh endpoint (prod cookie flags)', () => {
    let app;
    let server;
    let redis;
    beforeAll(async () => {
        redis = (0, fake_redis_1.createFakeRedis)();
        const moduleFixture = await testing_1.Test.createTestingModule({
            controllers: [auth_controller_1.AuthController],
            providers: [
                token_service_1.TokenService,
                session_service_1.SessionService,
                refresh_service_1.RefreshService,
                refresh_rate_limit_service_1.RefreshRateLimitService,
                { provide: password_service_1.PasswordService, useClass: StubPasswordService },
                { provide: users_service_1.UsersService, useValue: usersServiceStub },
                {
                    provide: config_1.ConfigService,
                    useValue: new ConfigServiceStub({
                        auth: {
                            ...ConfigServiceStub.defaultAuth,
                            cookie: {
                                sameSite: 'none',
                                secure: true,
                                refreshPath: '/api/auth/refresh',
                                accessPath: '/',
                            },
                        },
                        REFRESH_RL_MAX: '50',
                    }),
                },
                { provide: 'REDIS', useValue: redis },
            ],
        }).compile();
        app = moduleFixture.createNestApplication();
        app.use((0, cookie_parser_1.default)());
        app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
        app.useGlobalInterceptors(new transform_response_interceptor_1.TransformResponseInterceptor());
        app.enableCors({ origin: frontendOrigin, credentials: true });
        app.setGlobalPrefix('api');
        await app.init();
        server = app.getHttpServer();
    });
    afterAll(async () => {
        await app.close();
    });
    beforeEach(async () => {
        await flushRedis(redis);
        usersServiceStub.ensureActiveWithRoles.mockClear();
    });
    it('issues Secure + SameSite=None refresh cookies', async () => {
        const { cookie } = await login(server);
        expect(cookie.raw).toContain('SameSite=None');
        expect(cookie.raw).toMatch(/Secure/i);
    });
});
