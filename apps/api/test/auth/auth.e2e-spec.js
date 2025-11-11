"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
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
const jwt_auth_guard_1 = require("@app/core/auth/guards/jwt-auth.guard");
const profile_controller_1 = require("@app/core/users/profile/profile.controller");
const profile_service_1 = require("@app/core/users/profile/profile.service");
const users_service_1 = require("@app/core/users/users.service");
const transform_response_interceptor_1 = require("@app/common/interceptors/transform-response.interceptor");
const http_exception_filter_1 = require("@app/common/filters/http-exception.filter");
const prisma_constants_1 = require("@app/prisma/prisma.constants");
const fake_redis_1 = require("@test/utils/fake-redis");
const authConfig = {
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
class ConfigServiceStub {
    get(key) {
        switch (key) {
            case 'auth':
                return authConfig;
            case 'SESSION_TTL':
                return '30d';
            case 'GLOBAL_PREFIX':
                return 'api';
            case 'CORS_ORIGIN':
                return 'http://localhost:3000';
            case 'corsOrigins':
                return undefined;
            default:
                return undefined;
        }
    }
}
class StubPasswordService {
    async login(identifier, password) {
        if (['negare_user', 'user@example.com'].includes(identifier) &&
            password === 'Password!1') {
            return { userId: 'user-1' };
        }
        throw new common_1.UnauthorizedException({
            code: 'InvalidCredentials',
            message: 'Invalid credentials.',
        });
    }
}
class StubProfileService {
    async getProfile(userId) {
        return {
            id: userId,
            username: 'negare_user',
            email: 'user@example.com',
            name: 'Negare User',
        };
    }
    async updateProfile(userId) {
        return this.getProfile(userId);
    }
}
describe('Auth flows (e2e)', () => {
    let app;
    let agent;
    let redis;
    const usersServiceStub = {
        ensureActiveWithRoles: jest.fn().mockImplementation(async (userId) => ({
            id: userId,
            username: 'negare_user',
            userRoles: [{ role: { name: prisma_constants_1.RoleName.USER } }],
        })),
    };
    beforeAll(async () => {
        redis = (0, fake_redis_1.createFakeRedis)();
        const moduleFixture = await testing_1.Test.createTestingModule({
            controllers: [auth_controller_1.AuthController, profile_controller_1.ProfileController],
            providers: [
                jwt_auth_guard_1.JwtAuthGuard,
                token_service_1.TokenService,
                session_service_1.SessionService,
                refresh_service_1.RefreshService,
                refresh_rate_limit_service_1.RefreshRateLimitService,
                { provide: password_service_1.PasswordService, useClass: StubPasswordService },
                { provide: profile_service_1.ProfileService, useClass: StubProfileService },
                { provide: config_1.ConfigService, useClass: ConfigServiceStub },
                { provide: 'REDIS', useValue: redis },
                { provide: users_service_1.UsersService, useValue: usersServiceStub },
            ],
        }).compile();
        app = moduleFixture.createNestApplication();
        app.use((0, cookie_parser_1.default)());
        app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
        app.useGlobalInterceptors(new transform_response_interceptor_1.TransformResponseInterceptor());
        app.enableCors({
            origin: 'http://localhost:3000',
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            optionsSuccessStatus: 204,
        });
        app.use((_req, res, next) => {
            const existingVary = res.getHeader('Vary');
            const value = existingVary
                ? `${existingVary}, Origin`
                : 'Origin';
            res.setHeader('Vary', value);
            next();
        });
        app.setGlobalPrefix('api');
        await app.init();
        const server = app.getHttpServer();
        agent = supertest_1.default.agent(server);
    });
    afterAll(async () => {
        await app.close();
    });
    it('POST /api/auth/login issues tokens and sets refresh cookie (Path=/, HttpOnly)', async () => {
        const res = await agent
            .post('/api/auth/login')
            .set('Origin', 'http://localhost:3000')
            .send({ identifier: 'negare_user', password: 'Password!1' })
            .expect(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.accessToken).toEqual(expect.any(String));
        const setCookie = res.headers['set-cookie'];
        const cookies = Array.isArray(setCookie)
            ? setCookie
            : setCookie
                ? [setCookie]
                : [];
        const firstCookie = cookies[0] ?? '';
        expect(firstCookie).toContain('refresh_token=');
        expect(firstCookie).toContain('Path=/api/auth/refresh');
        expect(firstCookie).toContain('HttpOnly');
        expect(firstCookie).toMatch(/SameSite=Lax/i);
        expect(res.headers['cache-control']).toContain('no-store');
        expect(res.headers['vary']).toContain('Cookie');
    });
    it('POST /api/auth/refresh rotates the refresh cookie and returns a new access token', async () => {
        const res = await agent
            .post('/api/auth/refresh')
            .set('Origin', 'http://localhost:3000')
            .set('Content-Type', 'application/json')
            .send({})
            .expect(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.accessToken).toEqual(expect.any(String));
        const setCookie = res.headers['set-cookie'];
        const cookies = Array.isArray(setCookie)
            ? setCookie
            : setCookie
                ? [setCookie]
                : [];
        expect(cookies).toEqual(expect.arrayContaining([expect.stringContaining('refresh_token=')]));
        expect(cookies.join(';')).toContain('Path=/api/auth/refresh');
        expect(cookies.join(';')).toContain('HttpOnly');
    });
    it('GET /api/core/profile succeeds with bearer token', async () => {
        // refresh again to ensure we have a fresh access token
        const refreshRes = await agent
            .post('/api/auth/refresh')
            .set('Origin', 'http://localhost:3000')
            .set('Content-Type', 'application/json')
            .send({})
            .expect(200);
        const accessToken = refreshRes.body.data.accessToken;
        const res = await agent
            .get('/api/core/profile')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({
            id: 'user-1',
            username: 'negare_user',
        });
    });
    it('POST /api/auth/logout revokes refresh cookie across paths', async () => {
        const res = await agent.post('/api/auth/logout').send().expect(200);
        expect(res.body.success).toBe(true);
        const setCookie = res.headers['set-cookie'];
        const cookies = Array.isArray(setCookie)
            ? setCookie
            : setCookie
                ? [setCookie]
                : [];
        expect(cookies.length).toBeGreaterThanOrEqual(1);
        expect(cookies.join(';')).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
        expect(cookies.join(';')).toContain('Path=/api/auth/refresh');
    });
    it('CORS preflight honours credentials for auth endpoints', async () => {
        const res = await (0, supertest_1.default)(app.getHttpServer())
            .options('/api/auth/login')
            .set('Origin', 'http://localhost:3000')
            .set('Access-Control-Request-Method', 'POST')
            .set('Access-Control-Request-Headers', 'Content-Type')
            .expect(204);
        expect(res.headers['access-control-allow-credentials']).toBe('true');
        expect(res.headers['vary']).toContain('Origin');
    });
});
