import { Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';
import { StorageService, StoredFileMetadata, UploadedFile } from '@app/catalog/storage/storage.service';

@Injectable()
export class S3StorageService extends StorageService {
  // TODO: Integrate with AWS S3 SDK and configuration
  async saveUploadedFile(
    _file: UploadedFile,
  ): Promise<StoredFileMetadata> {
    throw new Error('S3 storage not implemented yet');
  }

  // TODO: Return signed stream from S3
  getDownloadStream(_storageKey: string): Readable {
    throw new Error('S3 storage not implemented yet');
  }

  // TODO: Generate pre-signed URL from S3
  getDownloadUrl(_storageKey: string): string {
    throw new Error('S3 storage not implemented yet');
  }

  async deleteFile(_storageKey: string): Promise<void> {
    throw new Error('S3 storage not implemented yet');
  }
}

