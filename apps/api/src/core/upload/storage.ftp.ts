// apps/api/src/core/upload/storage.ftp.ts
import * as ftp from 'basic-ftp';
import { posix as pathPosix } from 'path';
import * as fs from 'node:fs/promises';
import { Logger, type LoggerService } from '@nestjs/common';
import { type StorageDriver, type StorageUploadProgress } from './upload.types';

/**
 * بعضی نسخه‌های basic-ftp فیلد useEPSV را ندارند؛
 * آن را اختیاری اعلام می‌کنیم و فقط اگر وجود داشت مقدار می‌دهیم.
 */
declare module 'basic-ftp' {
  interface FTPContext {
    useEPSV?: boolean;
  }
}

/* --------------------------------- Types --------------------------------- */

type FtpOptions = {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean; // FTPS on/off
  publicRoot: string; // مثلا "public_html" یا "assets"
  timeoutMs?: number; // پیش‌فرض 120_000
  retries?: number; // پیش‌فرض 0
  disableEPSV?: boolean; // اگر true باشد و فیلد موجود باشد، useEPSV=false
};

type ProgressLike = Readonly<{
  bytes?: number;
  type?: string;
}>;

/* -------------------------------- Driver --------------------------------- */

export class FTPStorageDriver implements StorageDriver {
  private readonly logger: LoggerService;

  constructor(
    private readonly options: FtpOptions,
    logger?: LoggerService,
  ) {
    this.logger = logger ?? new Logger(FTPStorageDriver.name);
  }

  /* ------------------------------- Helpers -------------------------------- */

  private makeClient(): ftp.Client {
    const timeout = this.options.timeoutMs ?? 120_000;
    const client = new ftp.Client(timeout);
    client.ftp.verbose = false;

    if (
      this.options.disableEPSV === true &&
      typeof client.ftp.useEPSV === 'boolean'
    ) {
      client.ftp.useEPSV = false;
    }
    return client;
  }

  /** اتصال و اجرای کار با lifecycle ایمن */
  private async withClient<T>(work: (c: ftp.Client) => Promise<T>): Promise<T> {
    const client = this.makeClient();
    try {
      await client.access({
        host: this.options.host,
        port: this.options.port,
        user: this.options.user,
        password: this.options.pass,
        secure: this.options.secure,
        secureOptions: this.options.secure
          ? { rejectUnauthorized: false }
          : undefined,
      });
      return await work(client);
    } finally {
      client.close();
    }
  }

  /** backoff خطی ساده: 200ms, 400ms, 600ms, ... */
  private async retry<T>(fn: () => Promise<T>): Promise<T> {
    const attempts = Math.max(0, this.options.retries ?? 0) + 1;
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        if (i === attempts - 1) break;
        await new Promise((r) => setTimeout(r, 200 * (i + 1)));
      }
    }
    throw lastErr;
  }

  /** ساخت مسیر کامل روی FTP با ریشه‌ی پابلـیک */
  private fullRemotePath(relative: string): string {
    const root = this.options.publicRoot?.replace(/^\/+|\/+$/g, '') || '';
    const rel = relative.replace(/^\/+/, '');
    return root ? pathPosix.join(root, rel) : rel;
  }

  /* ---------------------------------- API --------------------------------- */

  async ensureDir(relativeDir: string): Promise<void> {
    const target = this.fullRemotePath(relativeDir);
    await this.retry(() =>
      this.withClient(async (c) => {
        await c.ensureDir(target); // idempotent
      }),
    );
  }

  async uploadFile(
    localPath: string,
    remoteRelativePath: string,
    onProgress?: (p: StorageUploadProgress) => void,
  ): Promise<void> {
    const remote = this.fullRemotePath(remoteRelativePath);
    this.logger.log(`FTP put: ${remote}`);
    const parent = pathPosix.dirname(remote);
    const base = pathPosix.basename(remote);

    // درصد
    let totalBytes = 0;
    try {
      const st = await fs.stat(localPath);
      totalBytes = st.size;
    } catch {
      /* ignore */
    }

    await this.retry(() =>
      this.withClient(async (c) => {
        // --- stepwise cd/ensure که با pwd فعلی هماهنگ می‌شود ---
        const cwd = await c.pwd(); // مثلا "/public_html"
        const segments = parent.split('/').filter(Boolean); // ["public_html","uploads","2025-11-05"]

        // اگر پوشه‌ی فعلی همین سگمنت اول است، از آن عبور کن
        let i = 0;
        if (segments.length > 0) {
          const cwdLast = cwd
            .replace(/\/+$/, '')
            .split('/')
            .filter(Boolean)
            .pop();
          if (cwdLast && cwdLast === segments[0]) {
            i = 1; // از public_html عبور کن چون همینجایی
          }
        }

        for (; i < segments.length; i++) {
          const seg = segments[i];
          try {
            await c.cd(seg);
          } catch {
            await c.ensureDir(seg);
            await c.cd(seg);
          }
        }

        if (onProgress) {
          type ProgressHandler = Parameters<ftp.Client['trackProgress']>[0];
          const handler: ProgressHandler = (info) => {
            const bytes = (info as { bytes?: number }).bytes ?? 0;
            const sent = bytes;
            const total = totalBytes;
            const percent =
              total > 0
                ? Math.min(100, Math.max(0, Math.round((sent / total) * 100)))
                : 0;
            onProgress({ sentBytes: sent, totalBytes: total, percent });
          };
          c.trackProgress(handler);
        }

        try {
          // بعد از cd مرحله‌ای، فقط basename را STOR کن
          await c.uploadFrom(localPath, base);
        } finally {
          c.trackProgress(); // stop
        }
      }),
    );
  }

  async exists(remoteRelativePath: string): Promise<boolean> {
    const remote = this.fullRemotePath(remoteRelativePath);
    return this.retry(() =>
      this.withClient(async (c) => {
        try {
          await c.size(remote);
          return true;
        } catch {
          return false;
        }
      }),
    );
  }

  async rename(
    oldRelativePath: string,
    newRelativePath: string,
  ): Promise<void> {
    const from = this.fullRemotePath(oldRelativePath);
    const to = this.fullRemotePath(newRelativePath);
    const parent = pathPosix.dirname(to);

    await this.retry(() =>
      this.withClient(async (c) => {
        await c.ensureDir(parent);
        await c.rename(from, to);
      }),
    );
  }

  async delete(remoteRelativePath: string): Promise<void> {
    const remote = this.fullRemotePath(remoteRelativePath);
    await this.retry(() =>
      this.withClient(async (c) => {
        try {
          await c.remove(remote);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // خطاهای "وجود ندارد" را نادیده بگیر
          if (/no such file|not found|ENOENT|550/i.test(msg)) return;
          throw e;
        }
      }),
    );
  }
}
