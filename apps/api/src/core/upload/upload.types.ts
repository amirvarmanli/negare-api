// ==============================
// Upload Types (hardened edition)
// ==============================

/** Utility: brand primitive types to avoid accidental mixups */
type Brand<T, B extends string> = T & { readonly __brand: B };

export type UploadId = Brand<string, 'UploadId'>;
export type UserId = Brand<string, 'UserId'>;
export type MimeType = Brand<string, 'MimeType'>;

/** Allowed states (keep original values for compatibility) */
export type UploadState =
  | 'init'
  | 'receiving'
  | 'ready-to-upload'
  | 'uploading'
  | 'uploaded'
  | 'error';

/** Client → Server: initialize an upload session */
export interface UploadInitInput {
  filename: string; // original filename from client
  size: number; // total bytes expected
  mime?: string | null; // optional client-declared MIME (hint only; server decides)
}

/** Server → Client: created session info (public-safe) */
export interface UploadInitOutput {
  readonly uploadId: UploadId; // unique session id
  readonly chunkSize: number; // required chunk size in bytes
  readonly totalChunks: number; // ceil(size / chunkSize)
  readonly expiresAt: number; // epoch ms (session TTL)
}

/** Persisted status (e.g., Redis). INTERNAL object - never expose as-is to client */
export interface UploadStatus {
  // Identity / ownership
  uploadId: UploadId;
  userId: UserId;

  // File meta
  filename: string; // original filename
  mime: MimeType; // MIME enforced/accepted by server
  size: number; // total bytes expected
  chunkSize: number; // per-session chunk size
  totalChunks: number; // normalized at init

  // Progress
  /** Informational only; can be derived from receivedIndexes*chunkSize with care */
  receivedBytes: number;
  /** Sorted, unique chunk indexes received so far (0..totalChunks-1) */
  receivedIndexes: number[];

  // Lifecycle / auditing
  state: UploadState;
  createdAt: number; // epoch ms
  expiresAt: number; // epoch ms
  version: number; // CAS/version for optimistic concurrency
  errorCode?: string; // set when state === 'error'

  // Paths (SERVER-ONLY; do not expose)
  /** Local temp file path - INTERNAL ONLY (never return to client/logs) */
  tempPath: string;
  /** Destination path relative to storage root (server derives & normalizes) */
  remoteRelativePath?: string;

  // Integrity (optional but recommended)
  /** Expected SHA-256 of the final file (hex/base64). If present, verify at finish. */
  sha256?: string;
}

/** Server → Client: response after accepting a chunk */
export interface UploadChunkResult {
  readonly receivedIndex: number; // index just accepted
  readonly receivedBytes: number; // cumulative bytes (informational)
  readonly percent: number; // 0..100 (based on bytes)
}

/** Server → Client: response after finalizing an upload */
export interface UploadFinishResult {
  readonly url: string; // public URL (CDN_BASE_URL + relative path)
  readonly path: string; // storage relative path
  readonly mime: MimeType;
  readonly size: number;
  readonly sha256?: string; // final checksum if computed
}

/** Progress callback payload from the storage driver */
export interface StorageUploadProgress {
  sentBytes: number; // bytes sent so far
  totalBytes: number; // total bytes to send
  percent: number; // 0..100
}

/**
 * Upload state store (e.g., Redis) abstraction.
 * MUST provide atomicity/locking to avoid races for parallel chunk writes.
 */
export interface UploadStateStore {
  /** Create new status with optional TTL (seconds). Must fail if key exists. */
  create(status: UploadStatus, ttlSec?: number): Promise<void>;

  /** Read current status; returns null if not found/expired. */
  get(uploadId: UploadId): Promise<UploadStatus | null>;

  /**
   * Patch using optimistic concurrency control.
   * Apply `patch` only if current `version` equals `expectedVersion`; then increment version.
   */
  patchCAS(
    uploadId: UploadId,
    expectedVersion: number,
    patch: Partial<UploadStatus>,
  ): Promise<boolean>;

  /**
   * Execute `work` within a distributed lock (e.g., Redlock).
   * Should time out if lock not acquired within ttlMs.
   */
  withLock<T>(
    uploadId: UploadId,
    ttlMs: number,
    work: () => Promise<T>,
  ): Promise<T>;

  /** Refresh TTL (seconds) without modifying the payload */
  touch(uploadId: UploadId, ttlSec: number): Promise<void>;

  /** Hard delete (e.g., after finish/abort/timeout cleanup) */
  delete(uploadId: UploadId): Promise<void>;
}

/**
 * Destination storage driver abstraction (FTP now, S3/MinIO later).
 * Methods marked optional are implemented only when meaningful for the backend.
 */
export interface StorageDriver {
  /** No-op for object stores; relevant for hierarchical backends like FTP */
  ensureDir?(relativeDir: string): Promise<void>;

  /**
   * Upload from a local file path to `remoteRelativePath`.
   * For object stores that lack true rename, prefer "copy+delete" semantics in `rename`.
   */
  uploadFile(
    localPath: string,
    remoteRelativePath: string,
    onProgress?: (p: StorageUploadProgress) => void,
  ): Promise<void>;

  /** Streamed upload for very large files (optional for FTP backends) */
  uploadStream?(
    readable: NodeJS.ReadableStream,
    remoteRelativePath: string,
    totalBytes?: number,
    onProgress?: (p: StorageUploadProgress) => void,
  ): Promise<void>;

  /** Check object existence */
  exists(remoteRelativePath: string): Promise<boolean>;

  /**
   * Rename/move object. If backend lacks native rename, implement as copy+delete.
   * Should be atomic from the perspective of callers (or fail with rollback).
   */
  rename(oldRelativePath: string, newRelativePath: string): Promise<void>;

  /** Delete remote object (for rollback/cleanup) */
  delete(remoteRelativePath: string): Promise<void>;
}

/**
 * Public-safe projections (optional helpers)
 * Use these when returning status-like summaries to clients to avoid leaking INTERNAL fields.
 */
export type PublicUploadStatus = Pick<
  UploadStatus,
  | 'uploadId'
  | 'filename'
  | 'mime'
  | 'size'
  | 'chunkSize'
  | 'totalChunks'
  | 'receivedBytes'
  | 'receivedIndexes'
  | 'state'
  | 'createdAt'
  | 'expiresAt'
> & { readonly percent?: number }; // computed on-the-fly; not persisted
