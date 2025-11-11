"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const path_1 = require("path");
const cwd = process.cwd();
(0, dotenv_1.config)({ path: (0, path_1.resolve)(cwd, '.env.test') });
(0, dotenv_1.config)({ path: (0, path_1.resolve)(cwd, '.env') });
process.env.AUTH_ACCESS_SECRET ??= 'dev_access_secret_for_tests';
process.env.AUTH_REFRESH_SECRET ??= 'dev_refresh_secret_for_tests';
process.env.AUTH_ACCESS_TTL ??= '900s';
process.env.AUTH_REFRESH_TTL ??= '30d';
process.env.ACCESS_JWT_SECRET ??=
    process.env.AUTH_ACCESS_SECRET ?? 'dev_access_secret_for_tests';
process.env.ACCESS_JWT_EXPIRES ??=
    process.env.AUTH_ACCESS_TTL ?? '900s';
process.env.REFRESH_JWT_SECRET ??=
    process.env.AUTH_REFRESH_SECRET ?? 'dev_refresh_secret_for_tests';
process.env.REFRESH_JWT_EXPIRES ??=
    process.env.AUTH_REFRESH_TTL ?? '30d';
process.env.SET_PWD_JWT_SECRET ??= 'test_set_password_secret';
process.env.SET_PWD_JWT_EXPIRES ??= '10m';
