// ==============================
// Injection tokens
// ==============================
export const UPLOAD_STATE_STORE = Symbol('UPLOAD_STATE_STORE');
export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');
export const UPLOAD_CONFIG = Symbol('UPLOAD_CONFIG');

// ==============================
// Config Types (hardened)
// ==============================

export type StorageBackendKind = 'ftp' | 's3' | 'local';

export interface BaseUploadConfig {
  /** Temporary directory for partial files (server-only) */
  tmpDir: string; // e.g. /tmp/negare-uploads

  /** Required chunk size in bytes; prefer multiples of 1 MiB (e.g. 5 * 1024 * 1024) */
  chunkSize: number;

  /** TTL for an upload session in seconds (e.g. 3600) */
  ttlSeconds: number;

  /** Max allowed file size in bytes (hard limit) */
  maxSizeBytes: number;

  /** Public base URL for final assets (no trailing slash) */
  cdnBaseUrl: string; // e.g. https://cdn.negare.com

  /**
   * Root "public" prefix on the remote (normalized, no leading slash for object stores)
   * e.g. "public_html" for FTP, or "assets" for S3
   */
  publicRoot: string;

  /**
   * Optional prefix directly under the public root (e.g. "cdn")
   * Added to generated remote paths and URLs when provided.
   */
  publicSubdir?: string;

  /**
   * Logical base directory under the (sub)docroot where uploads live.
   * Defaults to "uploads".
   */
  baseDir?: string;

  /** Allowed file extensions (lowercase, WITHOUT dot) */
  allowedExts?: string[];

  /** Allowed MIME types (lowercase) */
  allowedMime?: string[];

  /** Optional: sanitize/normalize policy for filenames (server applies) */
  filenamePolicy?: {
    /** Max base name length (without extension), default 100 */
    maxNameLength?: number;
    /** Replace invalid chars with this (default "-") */
    replaceWith?: string;
    /** Regex of allowed chars (apply to base name), default: /^[a-zA-Z0-9._-]+$/ */
    allowedNameRegex?: string;
  };

  /** Optional: retry/backoff settings for remote storage */
  retry?: {
    retries: number; // e.g. 3
    minDelayMs: number; // e.g. 250
    maxDelayMs: number; // e.g. 2000
    jitter?: boolean; // default true
  };

  /** Optional: upload parallelism & throttling */
  performance?: {
    maxConcurrentUploads?: number; // per process
    progressThrottleMs?: number; // min interval for progress callbacks
  };

  /** Keep temp file on remote upload failure for manual inspection */
  keepTempOnError?: boolean;

  /** Which backend driver to use */
  backend: StorageBackendKind;
}

/** FTP-specific config */
export interface FtpConfig {
  host: string;
  port?: number; // default 21
  secure?: boolean; // FTPS
  user: string;
  password: string;
  /** Passive mode toggle / timeouts, etc. */
  passive?: boolean;
  timeoutMs?: number; // e.g. 15000
}

/** S3-compatible config (AWS/MinIO) */
export interface S3Config {
  bucket: string;
  region?: string;
  endpoint?: string; // for MinIO
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean; // MinIO: true
}

/** Local FS config (for dev) */
export interface LocalConfig {
  rootDir: string; // absolute dir to store public files
}

/** Unified UploadConfig */
export interface UploadConfig extends BaseUploadConfig {
  ftp?: FtpConfig; // required if backend === 'ftp'
  s3?: S3Config; // required if backend === 's3'
  local?: LocalConfig; // required if backend === 'local'
}
