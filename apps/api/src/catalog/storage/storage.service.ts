import type { Readable } from 'node:stream';

export interface StoredFileMetadata {
  storageKey: string;
  originalName?: string;
  size?: number;
  mimeType?: string;
  meta?: Record<string, unknown>;
}

export interface UploadedFile {
  fieldname: string;
  originalname?: string;
  encoding?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
  stream?: Readable;
}

export abstract class StorageService {
  abstract saveUploadedFile(
    file: UploadedFile,
  ): Promise<StoredFileMetadata>;

  abstract getDownloadStream(storageKey: string): Readable;

  abstract getDownloadUrl(storageKey: string): string;

  abstract deleteFile(storageKey: string): Promise<void>;
}
