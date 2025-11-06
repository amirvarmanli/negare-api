// apps/api/src/core/upload/upload.cleanup.ts
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as fssync from 'node:fs';
import { basename, join } from 'node:path';
import { UPLOAD_CONFIG } from './upload.tokens';
import type { UploadConfig } from './upload.tokens';

function toInt(val: string | number | undefined, fallback: number): number {
  const n = typeof val === 'string' ? Number(val) : val;
  return Number.isFinite(n) && (n as number) > 0 ? (n as number) : fallback;
}

@Injectable()
export class UploadCleanup implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UploadCleanup.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(@Inject(UPLOAD_CONFIG) private readonly cfg: UploadConfig) {}

  private get tmpRoot(): string {
    return (
      process.env.UPLOAD_TMP_DIR || this.cfg.tmpDir || '/tmp/negare-uploads'
    );
  }
  private get intervalMin(): number {
    return toInt(process.env.UPLOAD_CLEAN_INTERVAL_MIN, 30);
  }
  private get maxAgeHours(): number {
    // حداقل از TTL ما یکی دو ساعت بیشتر باشد تا آپلودهای کند حذف نشوند
    const minFromTtl = Math.ceil((this.cfg.ttlSeconds ?? 3600) / 3600) + 1; // >= 2h
    return Math.max(
      toInt(process.env.UPLOAD_MAX_TEMP_AGE_HOURS, 6),
      minFromTtl,
    );
  }

  onModuleInit(): void {
    const ms = Math.max(1, this.intervalMin) * 60 * 1000;

    // اجرای اولیه (غیربلاک‌کننده)
    this.clean().catch((err) =>
      this.logger.warn(`Initial cleanup failed: ${this.errMsg(err)}`),
    );

    // زمان‌بندی دوره‌ای
    this.timer = setInterval(() => {
      if (this.running) return;
      this.running = true;
      this.clean()
        .catch((err) => this.logger.warn(`Cleanup failed: ${this.errMsg(err)}`))
        .finally(() => {
          this.running = false;
        });
    }, ms);
    this.timer.unref?.();

    this.logger.log(
      `Cleanup scheduled: every ${this.intervalMin} min, maxAge=${this.maxAgeHours}h, dir=${this.tmpRoot}`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** پاکسازی فایل‌های .part قدیمی داخل tmpRoot (فقط سطح اول پوشه) */
  async clean(): Promise<void> {
    await fs.mkdir(this.tmpRoot, { recursive: true });

    const entries = await fs.readdir(this.tmpRoot, { withFileTypes: true });
    const now = Date.now();
    const maxAgeMs = this.maxAgeHours * 3600 * 1000;

    let removed = 0;

    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith('.part')) continue;

      const filePath = join(this.tmpRoot, e.name);
      try {
        const stat = await fs.stat(filePath);
        const lastTouched =
          Math.max(stat.mtimeMs, stat.atimeMs || 0) || stat.mtimeMs;
        const ageMs = now - lastTouched;

        if (ageMs > maxAgeMs && !this.isLikelyOpen(filePath)) {
          await fs.rm(filePath, { force: true });
          removed++;
          this.logger.debug(`🧹 removed temp: ${e.name}`);
        }
      } catch (err) {
        this.logger.warn(`Skip ${e.name}: ${this.errMsg(err)}`);
      }
    }

    if (removed > 0) {
      this.logger.log(`Cleanup done: removed ${removed} file(s).`);
    }
  }

  /** تشخیص سادهٔ باز بودن فایل (best-effort) */
  private isLikelyOpen(filePath: string): boolean {
    try {
      const fd = fssync.openSync(filePath, 'r+');
      fssync.closeSync(fd);
      return false;
    } catch {
      return true; // اگر باز نشد، حذف نکنیم بهتر است
    }
  }

  private errMsg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
