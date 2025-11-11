import { type UploadStatus, type UploadStateStore, type UploadId, type StorageDriver, type StorageUploadProgress } from '@app/core/upload/upload.types';
export declare class InMemoryUploadStateStore implements UploadStateStore {
    private readonly useLocks;
    private readonly items;
    private readonly locks;
    constructor(useLocks?: boolean);
    create(status: UploadStatus, ttlSec?: number): Promise<void>;
    get(uploadId: UploadId): Promise<UploadStatus | null>;
    patchCAS(uploadId: UploadId, expectedVersion: number, patch: Partial<UploadStatus>): Promise<boolean>;
    withLock<T>(uploadId: UploadId, _ttlMs: number, work: () => Promise<T>): Promise<T>;
    touch(uploadId: UploadId, ttlSec: number): Promise<void>;
    delete(uploadId: UploadId): Promise<void>;
    peek(uploadId: string): UploadStatus | undefined;
    clear(): void;
}
export declare class FakeStorageDriver implements StorageDriver {
    readonly uploaded: Map<string, Buffer<ArrayBufferLike>>;
    readonly ensuredDirs: Set<string>;
    deleted: string[];
    ensureDir(relativeDir: string): Promise<void>;
    uploadFile(localPath: string, remoteRelativePath: string, onProgress?: (p: StorageUploadProgress) => void): Promise<void>;
    exists(remoteRelativePath: string): Promise<boolean>;
    rename(oldRelativePath: string, newRelativePath: string): Promise<void>;
    delete(remoteRelativePath: string): Promise<void>;
    seed(remoteRelativePath: string, content: Buffer): void;
}
export declare class MockMediaService {
    readonly records: Array<{
        id: string;
        userId: string;
        filename: string;
        mime: string;
        size: bigint;
        path: string;
        url: string;
        status: string;
    }>;
    fail: boolean;
    createFile(input: {
        userId: string;
        filename: string;
        mime: string;
        size: bigint;
        path: string;
        url: string;
        status?: string;
    }): Promise<{
        status: string;
        id: `${string}-${string}-${string}-${string}-${string}`;
        userId: string;
        filename: string;
        mime: string;
        size: bigint;
        path: string;
        url: string;
    }>;
}
