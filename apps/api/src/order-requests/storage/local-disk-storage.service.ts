import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AllConfig } from '@app/config/config.module';
import { promises as fs } from 'fs';
import path from 'path';
import type {
  OrderRequestFileSaveArgs,
  OrderRequestFileSaveResult,
  StorageService,
} from '@app/order-requests/storage/storage.types';

@Injectable()
export class LocalDiskStorageService implements StorageService {
  constructor(private readonly config: ConfigService<AllConfig>) {}

  async saveOrderRequestFile(
    args: OrderRequestFileSaveArgs,
  ): Promise<OrderRequestFileSaveResult> {
    const uploadDir = this.getUploadDir();
    const safeName = this.sanitizeFileName(args.file.originalname);
    const timestamp = Date.now();
    const relativePath = path.join(
      'order-requests',
      args.orderRequestId,
      `${timestamp}_${safeName}`,
    );
    const absolutePath = path.join(uploadDir, relativePath);

    if (!args.file.buffer) {
      throw new BadRequestException('Uploaded file buffer is missing.');
    }

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, args.file.buffer);

    return {
      storageKey: this.toStorageKey(relativePath),
      size: args.file.size,
      mimeType: args.file.mimetype,
      originalName: args.file.originalname,
      kind: args.kind,
    };
  }

  async remove(storageKey: string): Promise<void> {
    const uploadDir = this.getUploadDir();
    const absolutePath = path.join(uploadDir, storageKey);
    try {
      await fs.unlink(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private getUploadDir(): string {
    const raw = this.config.get<string>('UPLOAD_DIR');
    return path.resolve(raw ?? './uploads');
  }

  private sanitizeFileName(input: string): string {
    const base = path.basename(input).normalize('NFKD');
    const sanitized = base.replace(/[^A-Za-z0-9._-]+/g, '_');
    return sanitized.length > 0 ? sanitized : 'file';
  }

  private toStorageKey(relativePath: string): string {
    return relativePath.split(path.sep).join(path.posix.sep);
  }
}
