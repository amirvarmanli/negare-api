import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  type UploadStatus,
  type UploadStateStore,
  type UploadId,
  type StorageDriver,
  type StorageUploadProgress,
} from '@app/core/upload/upload.types';

type MutableUploadStatus = UploadStatus & { version: number };

function cloneStatus(status: UploadStatus): UploadStatus {
  return {
    ...status,
    receivedIndexes: [...status.receivedIndexes],
  };
}

export class InMemoryUploadStateStore implements UploadStateStore {
  private readonly items = new Map<string, MutableUploadStatus>();
  private readonly locks = new Map<string, boolean>();

  constructor(private readonly useLocks = true) {}

  async create(status: UploadStatus, ttlSec?: number): Promise<void> {
    const id = String(status.uploadId);
    if (this.items.has(id)) {
      throw new Error('exists');
    }
    const clone: MutableUploadStatus = {
      ...cloneStatus(status),
      version: status.version ?? 1,
      expiresAt:
        status.expiresAt ?? Date.now() + Math.max(1, ttlSec ?? 1) * 1000,
    };
    this.items.set(id, clone);
  }

  async get(uploadId: UploadId): Promise<UploadStatus | null> {
    const id = String(uploadId);
    const cur = this.items.get(id);
    if (!cur) return null;
    return cloneStatus(cur);
  }

  async patchCAS(
    uploadId: UploadId,
    expectedVersion: number,
    patch: Partial<UploadStatus>,
  ): Promise<boolean> {
    const id = String(uploadId);
    const cur = this.items.get(id);
    if (!cur) return false;
    if (cur.version !== expectedVersion) return false;

    const merged: MutableUploadStatus = {
      ...cur,
      ...patch,
      version: expectedVersion + 1,
    };
    if (patch.receivedIndexes) {
      const unique = new Set([...cur.receivedIndexes, ...patch.receivedIndexes]);
      merged.receivedIndexes = Array.from(unique).sort((a, b) => a - b);
    } else {
      merged.receivedIndexes = [...cur.receivedIndexes];
    }
    if (typeof patch.receivedBytes === 'number') {
      merged.receivedBytes = Math.max(cur.receivedBytes, patch.receivedBytes);
    }
    if (patch.expiresAt) {
      merged.expiresAt = patch.expiresAt;
    }

    this.items.set(id, merged);
    return true;
  }

  async withLock<T>(
    uploadId: UploadId,
    _ttlMs: number,
    work: () => Promise<T>,
  ): Promise<T> {
    if (!this.useLocks) {
      return work();
    }
    const id = String(uploadId);
    if (this.locks.get(id)) {
      throw new Error('lock busy');
    }
    this.locks.set(id, true);
    try {
      return await work();
    } finally {
      this.locks.delete(id);
    }
  }

  async touch(uploadId: UploadId, ttlSec: number): Promise<void> {
    const id = String(uploadId);
    const cur = this.items.get(id);
    if (!cur) throw new Error('missing');
    cur.expiresAt = Date.now() + ttlSec * 1000;
  }

  async delete(uploadId: UploadId): Promise<void> {
    const id = String(uploadId);
    this.items.delete(id);
  }

  /** Utility for tests to peek current internal state */
  peek(uploadId: string): UploadStatus | undefined {
    const cur = this.items.get(uploadId);
    return cur ? cloneStatus(cur) : undefined;
  }

  clear(): void {
    this.items.clear();
    this.locks.clear();
  }
}

export class FakeStorageDriver implements StorageDriver {
  public readonly uploaded = new Map<string, Buffer>();
  public readonly ensuredDirs = new Set<string>();
  public deleted: string[] = [];

  async ensureDir(relativeDir: string): Promise<void> {
    this.ensuredDirs.add(relativeDir.replace(/\\/g, '/'));
  }

  async uploadFile(
    localPath: string,
    remoteRelativePath: string,
    onProgress?: (p: StorageUploadProgress) => void,
  ): Promise<void> {
    const content = await fs.readFile(localPath);
    const total = content.length;
    if (onProgress) {
      let sent = 0;
      const step = Math.max(1, Math.floor(total / 3));
      while (sent < total) {
        sent = Math.min(total, sent + step);
        onProgress({
          sentBytes: sent,
          totalBytes: total,
          percent: Math.floor((sent / total) * 100),
        });
      }
    }
    this.uploaded.set(remoteRelativePath, content);
  }

  async exists(remoteRelativePath: string): Promise<boolean> {
    return this.uploaded.has(remoteRelativePath);
  }

  async rename(oldRelativePath: string, newRelativePath: string): Promise<void> {
    const buf = this.uploaded.get(oldRelativePath);
    if (!buf) throw new Error('missing');
    this.uploaded.delete(oldRelativePath);
    this.uploaded.set(newRelativePath, buf);
  }

  async delete(remoteRelativePath: string): Promise<void> {
    this.deleted.push(remoteRelativePath);
    this.uploaded.delete(remoteRelativePath);
  }

  /** Helper for tests to seed existing remote file */
  seed(remoteRelativePath: string, content: Buffer): void {
    this.uploaded.set(remoteRelativePath, content);
  }
}

export class MockMediaService {
  public readonly records: Array<{
    id: string;
    userId: string;
    filename: string;
    mime: string;
    size: bigint;
    path: string;
    url: string;
    status: string;
  }> = [];
  public fail = false;

  async createFile(input: {
    userId: string;
    filename: string;
    mime: string;
    size: bigint;
    path: string;
    url: string;
    status?: string;
  }) {
    if (this.fail) {
      throw new Error('db error');
    }
    const record = {
      ...input,
      status: input.status ?? 'uploaded',
      id: randomUUID(),
    };
    this.records.push(record);
    return record;
  }
}
