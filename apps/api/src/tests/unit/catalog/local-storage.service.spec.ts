import { Readable } from 'node:stream';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { UploadedFile } from '@app/catalog/storage/storage.service';
import { LocalStorageService } from '@app/catalog/storage/local-storage.service';

describe('LocalStorageService', () => {
  const storage = new LocalStorageService();

  const createFile = (body: string): UploadedFile => ({
    fieldname: 'file',
    originalname: 'test.txt',
    encoding: '7bit',
    mimetype: 'text/plain',
    size: Buffer.byteLength(body),
    buffer: Buffer.from(body),
    stream: Readable.from(body),
  });

  const streamToString = async (stream: NodeJS.ReadableStream): Promise<string> => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  };

  it('persists uploads and provides readable streams', async () => {
    const file = createFile('storage payload');

    const stored = await storage.saveUploadedFile(file);

    const storedPath = join(process.cwd(), 'storage', 'products', stored.storageKey);
    await expect(access(storedPath, constants.F_OK)).resolves.not.toThrow();

    const stream = storage.getDownloadStream(stored.storageKey);
    await expect(streamToString(stream)).resolves.toBe('storage payload');

    await expect(storage.deleteFile(stored.storageKey)).resolves.toBeUndefined();
  });
});
