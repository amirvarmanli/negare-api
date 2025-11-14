// apps/api/src/core/upload/upload.module.ts
import {
  Module,
  Provider,
  OnApplicationShutdown,
  Injectable,
} from '@nestjs/common';
import { UploadService } from '@app/core/upload/upload.service';
import {
  UPLOAD_CONFIG,
  UPLOAD_STATE_STORE,
  STORAGE_DRIVER,
  type UploadConfig,
} from '@app/core/upload/upload.tokens';
import { RedisUploadStateStore } from '@app/core/upload/upload.state.redis';
import type Redis from 'ioredis';
import IORedis from 'ioredis';
import { UploadController } from '@app/core/upload/upload.controller';
import { FTPStorageDriver } from '@app/core/upload/storage.ftp';
import { UploadGateway } from '@app/core/upload/upload.gateway';
import { UploadCleanup } from '@app/core/upload/upload.cleanup';
import { MediaModule } from '@app/core/media/media.module';
import type { IntegrityMode } from '@app/core/upload/upload.types';

/* -------------------------------------------------------------------------- */
/*                              Helper functions                              */
/* -------------------------------------------------------------------------- */
function reqEnv(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`[UploadModule] Missing env: ${name}`);
  return v;
}

function toNum(v: string | undefined, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function toList(v?: string): string[] | undefined {
  const arr = (v ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return arr.length ? arr : undefined;
}

const DEFAULT_ALLOWED_EXTS = [
  'rar',
  'zip',
  'pdf',
  'ai',
  'eps',
  'svg',
  'psd',
  'cdr',
  'aep',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'ttf',
  'otf',
  'woff',
  'woff2',
  'mp4',
  'mkv',
];

const DEFAULT_ALLOWED_MIME = [
  'application/vnd.rar',
  'application/x-rar-compressed',
  'application/zip',
  'application/x-zip-compressed',
  'application/postscript',
  'application/pdf',
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/vnd.adobe.photoshop',
  'application/cdr',
  'application/vnd.corel-draw',
  'application/vnd.adobe.aftereffects.project',
  'font/ttf',
  'application/x-font-ttf',
  'font/otf',
  'application/x-font-otf',
  'font/woff',
  'font/woff2',
  'video/mp4',
  'video/x-matroska',
  'application/octet-stream',
];

function parseIntegrityMode(
  name: string,
  fallback: IntegrityMode,
): IntegrityMode {
  const raw = (process.env[name] ?? fallback).toString().toLowerCase();
  if (raw === 'required' || raw === 'optional' || raw === 'off') {
    return raw;
  }
  return fallback;
}

/* -------------------------------------------------------------------------- */
/*                           Redis Client Provider                            */
/* -------------------------------------------------------------------------- */
@Injectable()
class UploadRedisClient implements OnApplicationShutdown {
  public readonly client: Redis;

  constructor() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.client = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }

  async onApplicationShutdown() {
    try {
      await this.client.quit();
    } catch {
      await this.client.disconnect();
    }
  }
}

const REDIS_CLIENT = Symbol('UPLOAD_REDIS_CLIENT');

const redisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (holder: UploadRedisClient) => holder.client,
  inject: [UploadRedisClient],
};

/* -------------------------------------------------------------------------- */
/*                            Upload Config Provider                          */
/* -------------------------------------------------------------------------- */
const uploadConfigProvider: Provider = {
  provide: UPLOAD_CONFIG,
  useFactory: (): UploadConfig => {
    const cdnBase =
      process.env.FILE_PUBLIC_BASE_URL || // ✅ لینک نهایی CDN
      process.env.CDN_BASE_URL ||
      process.env.FTP_PUBLIC_BASE_URL ||
      '';

    return {
      tmpDir: process.env.UPLOAD_TMP_DIR ?? '/tmp/negare-uploads',
      chunkSize: toNum(process.env.UPLOAD_CHUNK_SIZE, 5 * 1024 * 1024), // 5MB
      ttlSeconds: toNum(process.env.UPLOAD_TTL_SECONDS, 24 * 60 * 60), // 24h
      maxSizeBytes: toNum(
        process.env.UPLOAD_MAX_SIZE_BYTES,
        5 * 1024 * 1024 * 1024, // 5GB
      ),

      // 🔗 آدرس عمومی فایل‌ها
      cdnBaseUrl: cdnBase,

      // 📂 مسیرهای داخل هاست
      publicRoot:
        process.env.FTP_DOCROOT ?? 'domains/pz19003.parspack.net/public_html',
      publicSubdir: process.env.UPLOAD_PUBLIC_SUBDIR ?? '',
      baseDir: process.env.UPLOAD_BASE_DIR ?? 'uploads',

      // ✅ فیلتر MIME / EXT
      allowedExts: toList(process.env.ALLOWED_EXTS) ?? DEFAULT_ALLOWED_EXTS,
      allowedMime: toList(process.env.ALLOWED_MIME) ?? DEFAULT_ALLOWED_MIME,

      integrity: {
        chunkHash: parseIntegrityMode('UPLOAD_INTEGRITY_CHUNK', 'optional'),
        fileHash: parseIntegrityMode('UPLOAD_INTEGRITY_FILE', 'off'),
      },

      backend: 'ftp',
    };
  },
};

/* -------------------------------------------------------------------------- */
/*                         Upload State Store (Redis)                         */
/* -------------------------------------------------------------------------- */
const uploadStateStoreProvider: Provider = {
  provide: UPLOAD_STATE_STORE,
  inject: [REDIS_CLIENT, UPLOAD_CONFIG],
  useFactory: (redis: Redis, cfg: UploadConfig) =>
    new RedisUploadStateStore(redis, cfg.ttlSeconds),
};

/* -------------------------------------------------------------------------- */
/*                           Storage Driver Provider                          */
/* -------------------------------------------------------------------------- */
const storageDriverProvider: Provider = {
  provide: STORAGE_DRIVER,
  inject: [UPLOAD_CONFIG],
  useFactory: (cfg: UploadConfig) => {
    const host = reqEnv('FTP_HOST');
    const port = Number(reqEnv('FTP_PORT', '21'));
    const user = reqEnv('FTP_USER');
    const pass = reqEnv('FTP_PASS');
    const secure = String(process.env.FTP_SECURE) === 'true';
    const publicRoot = cfg.publicRoot || 'public_html';

    return new FTPStorageDriver({
      host,
      port,
      user,
      pass,
      secure,
      publicRoot,
    });
  },
};

/* -------------------------------------------------------------------------- */
/*                                  Module                                    */
/* -------------------------------------------------------------------------- */
@Module({
  imports: [MediaModule],
  controllers: [UploadController],
  providers: [
    UploadRedisClient,
    redisClientProvider,
    uploadConfigProvider,
    uploadStateStoreProvider,
    storageDriverProvider,
    UploadService,
    UploadGateway,
    UploadCleanup,
  ],
  exports: [
    UploadService,
    UPLOAD_CONFIG,
    UPLOAD_STATE_STORE,
    STORAGE_DRIVER,
    REDIS_CLIENT,
  ],
})
export class UploadModule {}
