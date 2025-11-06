// apps/api/src/core/upload/redis-upload-state.store.ts
import type Redis from 'ioredis';
import { type UploadStatus, type UploadStateStore } from './upload.types';

// Small helpers
const PREFIX = 'upload:';
const LOCK_PREFIX = 'upload:lock:';

function keyOf(id: string) {
  return `${PREFIX}${id}`;
}
function lockKeyOf(id: string) {
  return `${LOCK_PREFIX}${id}`;
}
function ensureSortedUnique(nums: number[]): number[] {
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}
function nowMs() {
  return Date.now();
}

/**
 * RedisUploadStateStore (hardened)
 * - NO overwrite on create (SET NX)
 * - CAS patch via WATCH/MULTI/EXEC with monotonically increasing `version`
 * - TTL preserved or refreshed as needed
 * - `withLock` using SET NX with expiry (best-effort lock)
 */
export class RedisUploadStateStore implements UploadStateStore {
  constructor(
    private readonly redis: Redis,
    private readonly defaultTtlSeconds: number,
  ) {}

  /** Create new status with TTL. Fails if key exists. */
  async create(status: UploadStatus, ttlSec?: number): Promise<void> {
    // sanity
    if (!status?.uploadId) throw new Error('create(): uploadId is required');
    if (!status?.userId) throw new Error('create(): userId is required');

    // normalize fields
    const clone: UploadStatus = {
      ...status,
      receivedIndexes: ensureSortedUnique(status.receivedIndexes ?? []),
      receivedBytes: status.receivedBytes ?? 0,
      createdAt: status.createdAt ?? nowMs(),
      expiresAt:
        status.expiresAt ?? nowMs() + 1000 * (ttlSec ?? this.defaultTtlSeconds),
      version: (status as any).version ?? 1, // start from 1 if absent
    };

    const key = keyOf(clone.uploadId as unknown as string);
    const ex = ttlSec ?? this.defaultTtlSeconds;

    // NX: do not overwrite existent records
    const ok = await this.redis.set(key, JSON.stringify(clone), 'EX', ex, 'NX');
    if (ok !== 'OK') {
      throw new Error('create(): key already exists');
    }
  }

  /** Get status; null if missing/invalid JSON */
  async get(uploadId: string): Promise<UploadStatus | null> {
    const raw = await this.redis.get(keyOf(uploadId));
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw) as UploadStatus;
      if (!obj?.uploadId || !obj?.userId) return null;

      // minimal normalization (never mutates Redis here)
      obj.receivedIndexes = ensureSortedUnique(obj.receivedIndexes ?? []);
      (obj as any).version = (obj as any).version ?? 1;

      return obj;
    } catch {
      return null;
    }
  }

  /**
   * Optimistic patch:
   * - Reads current
   * - Verifies version === expectedVersion
   * - Applies patch, bumps version, keeps TTL (or resets if missing)
   */
  async patchCAS(
    uploadId: string,
    expectedVersion: number,
    patch: Partial<UploadStatus>,
  ): Promise<boolean> {
    const key = keyOf(uploadId);

    // Try CAS with WATCH
    await this.redis.watch(key);
    try {
      const raw = await this.redis.get(key);
      if (!raw) {
        await this.redis.unwatch();
        return false;
      }
      let cur: UploadStatus;
      try {
        cur = JSON.parse(raw) as UploadStatus;
      } catch {
        await this.redis.unwatch();
        return false;
      }

      const curVersion = (cur as any).version ?? 1;
      if (curVersion !== expectedVersion) {
        await this.redis.unwatch();
        return false;
      }

      // merge
      const merged: UploadStatus = this.mergeStatus(cur, patch);
      (merged as any).version = curVersion + 1;

      // preserve TTL if present, else reset to default
      // NOTE: ioredis.ttl returns seconds; -2 no key, -1 no expire
      const ttl = await this.redis.ttl(key);
      const ex = ttl > 0 ? ttl : this.defaultTtlSeconds;

      const tx = this.redis.multi();
      tx.set(key, JSON.stringify(merged), 'EX', ex);
      const res = await tx.exec(); // null if aborted
      return !!res;
    } finally {
      // ensure unwatch in any case
      try {
        await this.redis.unwatch();
      } catch {}
    }
  }

  /** Best-effort lock around a unit of work (single-process fairness not guaranteed) */
  async withLock<T>(
    uploadId: string,
    ttlMs: number,
    work: () => Promise<T>,
  ): Promise<T> {
    const lockKey = lockKeyOf(uploadId);
    const lockId = `${process.pid}-${Math.random().toString(36).slice(2)}`;
    const acquire = async () => {
      const ok = await this.redis.set(lockKey, lockId, 'PX', ttlMs, 'NX');
      return ok === 'OK';
    };

    // quick spin with small backoff
    const deadline = Date.now() + Math.max(ttlMs, 1000);
    while (!(await acquire())) {
      if (Date.now() > deadline) {
        throw new Error('withLock(): failed to acquire lock');
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    try {
      return await work();
    } finally {
      // release lock only if we still own it
      try {
        const val = await this.redis.get(lockKey);
        if (val === lockId) {
          await this.redis.del(lockKey);
        }
      } catch {
        // swallow
      }
    }
  }

  /** Refresh expiry (TTL) without changing payload */
  async touch(uploadId: string, ttlSec: number): Promise<void> {
    const key = keyOf(uploadId);
    // EXPIRE returns 1 if timeout set, 0 if key doesn't exist
    const ok = await this.redis.expire(key, Math.max(1, ttlSec));
    if (ok !== 1) {
      throw new Error('touch(): key not found');
    }
  }

  /** Hard delete */
  async delete(uploadId: string): Promise<void> {
    await this.redis.del(keyOf(uploadId));
  }

  // -----------------------
  // Internal merge strategy
  // -----------------------
  private mergeStatus(
    cur: UploadStatus,
    patch: Partial<UploadStatus>,
  ): UploadStatus {
    const merged: UploadStatus = { ...cur, ...patch };

    // normalize receivedIndexes
    if (patch.receivedIndexes) {
      merged.receivedIndexes = ensureSortedUnique([
        ...cur.receivedIndexes,
        ...patch.receivedIndexes,
      ]);
    } else {
      merged.receivedIndexes = ensureSortedUnique(cur.receivedIndexes ?? []);
    }

    // progress: pick max to be race-safe
    if (typeof patch.receivedBytes === 'number') {
      merged.receivedBytes = Math.max(
        cur.receivedBytes ?? 0,
        patch.receivedBytes,
      );
    } else {
      merged.receivedBytes = cur.receivedBytes ?? 0;
    }

    // do not regress expiresAt unless explicitly provided
    merged.expiresAt = patch.expiresAt ?? cur.expiresAt;

    // userId guarded
    merged.userId = patch.userId ?? cur.userId;

    // keep createdAt
    merged.createdAt = cur.createdAt ?? nowMs();

    // ensure state
    merged.state = patch.state ?? cur.state;

    return merged;
  }
}
