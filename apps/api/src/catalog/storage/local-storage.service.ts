import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { StorageService, StoredFileMetadata, UploadedFile } from '@app/catalog/storage/storage.service';

@Injectable()
export class LocalStorageService extends StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly storageRoot = join(process.cwd(), 'storage', 'products');

  async saveUploadedFile(file: UploadedFile): Promise<StoredFileMetadata> {
    if (!file) {
      throw new Error('No file received for storage');
    }

    if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
      throw new Error('Local storage adapter requires memory storage uploads');
    }

    const extension = file.originalname ? extname(file.originalname) : '';
    const storageKey = `${randomUUID()}${extension}`;
    const filePath = this.resolvePath(storageKey);

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file.buffer);

    return {
      storageKey,
      originalName: file.originalname ?? undefined,
      size: file.size ?? file.buffer.length,
      mimeType: file.mimetype ?? undefined,
    };
  }

  getDownloadStream(storageKey: string) {
    return createReadStream(this.resolvePath(storageKey));
  }

  getDownloadUrl(storageKey: string): string {
    return `/catalog/storage/local/${encodeURIComponent(storageKey)}`;
  }

  async deleteFile(storageKey: string): Promise<void> {
    try {
      await unlink(this.resolvePath(storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Failed to delete local file for key ${storageKey}: ${(error as Error).message}`);
        throw error;
      }
    }
  }

  private resolvePath(storageKey: string): string {
    const normalised = storageKey.replace(/\\/g, '/');
    return join(this.storageRoot, normalised);
  }
}
