"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockMediaService = exports.FakeStorageDriver = exports.InMemoryUploadStateStore = void 0;
const node_fs_1 = require("node:fs");
const node_crypto_1 = require("node:crypto");
function cloneStatus(status) {
    return {
        ...status,
        receivedIndexes: [...status.receivedIndexes],
    };
}
class InMemoryUploadStateStore {
    useLocks;
    items = new Map();
    locks = new Map();
    constructor(useLocks = true) {
        this.useLocks = useLocks;
    }
    async create(status, ttlSec) {
        const id = String(status.uploadId);
        if (this.items.has(id)) {
            throw new Error('exists');
        }
        const clone = {
            ...cloneStatus(status),
            version: status.version ?? 1,
            expiresAt: status.expiresAt ?? Date.now() + Math.max(1, ttlSec ?? 1) * 1000,
        };
        this.items.set(id, clone);
    }
    async get(uploadId) {
        const id = String(uploadId);
        const cur = this.items.get(id);
        if (!cur)
            return null;
        return cloneStatus(cur);
    }
    async patchCAS(uploadId, expectedVersion, patch) {
        const id = String(uploadId);
        const cur = this.items.get(id);
        if (!cur)
            return false;
        if (cur.version !== expectedVersion)
            return false;
        const merged = {
            ...cur,
            ...patch,
            version: expectedVersion + 1,
        };
        if (patch.receivedIndexes) {
            const unique = new Set([...cur.receivedIndexes, ...patch.receivedIndexes]);
            merged.receivedIndexes = Array.from(unique).sort((a, b) => a - b);
        }
        else {
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
    async withLock(uploadId, _ttlMs, work) {
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
        }
        finally {
            this.locks.delete(id);
        }
    }
    async touch(uploadId, ttlSec) {
        const id = String(uploadId);
        const cur = this.items.get(id);
        if (!cur)
            throw new Error('missing');
        cur.expiresAt = Date.now() + ttlSec * 1000;
    }
    async delete(uploadId) {
        const id = String(uploadId);
        this.items.delete(id);
    }
    /** Utility for tests to peek current internal state */
    peek(uploadId) {
        const cur = this.items.get(uploadId);
        return cur ? cloneStatus(cur) : undefined;
    }
    clear() {
        this.items.clear();
        this.locks.clear();
    }
}
exports.InMemoryUploadStateStore = InMemoryUploadStateStore;
class FakeStorageDriver {
    uploaded = new Map();
    ensuredDirs = new Set();
    deleted = [];
    async ensureDir(relativeDir) {
        this.ensuredDirs.add(relativeDir.replace(/\\/g, '/'));
    }
    async uploadFile(localPath, remoteRelativePath, onProgress) {
        const content = await node_fs_1.promises.readFile(localPath);
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
    async exists(remoteRelativePath) {
        return this.uploaded.has(remoteRelativePath);
    }
    async rename(oldRelativePath, newRelativePath) {
        const buf = this.uploaded.get(oldRelativePath);
        if (!buf)
            throw new Error('missing');
        this.uploaded.delete(oldRelativePath);
        this.uploaded.set(newRelativePath, buf);
    }
    async delete(remoteRelativePath) {
        this.deleted.push(remoteRelativePath);
        this.uploaded.delete(remoteRelativePath);
    }
    /** Helper for tests to seed existing remote file */
    seed(remoteRelativePath, content) {
        this.uploaded.set(remoteRelativePath, content);
    }
}
exports.FakeStorageDriver = FakeStorageDriver;
class MockMediaService {
    records = [];
    fail = false;
    async createFile(input) {
        if (this.fail) {
            throw new Error('db error');
        }
        const record = {
            ...input,
            status: input.status ?? 'uploaded',
            id: (0, node_crypto_1.randomUUID)(),
        };
        this.records.push(record);
        return record;
    }
}
exports.MockMediaService = MockMediaService;
