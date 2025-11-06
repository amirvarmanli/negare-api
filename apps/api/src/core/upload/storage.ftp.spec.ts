import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FTPStorageDriver } from './storage.ftp';

const ensureDirMock = jest.fn(async () => undefined);
const uploadFromMock = jest.fn(async () => undefined);
const accessMock = jest.fn(async () => undefined);
const closeMock = jest.fn();
const pwdMock = jest.fn(async () => '/');
const cdMock = jest.fn(async () => undefined);
const trackProgressMock = jest.fn();

jest.mock('basic-ftp', () => {
  class MockClient {
    public readonly ftp = { verbose: false as boolean, useEPSV: true as boolean };

    async access(options: unknown) {
      return accessMock(options);
    }

    close() {
      closeMock();
    }

    async ensureDir(path: string) {
      return ensureDirMock(path);
    }

    async uploadFrom(local: string, remote: string) {
      return uploadFromMock(local, remote);
    }

    async pwd() {
      return pwdMock();
    }

    async cd(segment: string) {
      return cdMock(segment);
    }

    trackProgress(handler?: unknown) {
      return trackProgressMock(handler);
    }
  }

  return { Client: MockClient };
});

describe('FTPStorageDriver logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs resolved FTP destination before uploading', async () => {
    const tmpDir = await fs.mkdtemp(join(tmpdir(), 'ftp-driver-'));
    const localFile = join(tmpDir, 'sample.txt');
    await fs.writeFile(localFile, 'hello');

    const logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const driver = new FTPStorageDriver(
      {
        host: 'localhost',
        port: 21,
        user: 'user',
        pass: 'pass',
        secure: false,
        publicRoot: 'domains/example.com/public_html',
      },
      logger,
    );

    try {
      await driver.uploadFile(
        localFile,
        'cdn/uploads/2025-11-06/uuid-file.txt',
      );
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }

    expect(logger.log).toHaveBeenCalledWith(
      'FTP put: domains/example.com/public_html/cdn/uploads/2025-11-06/uuid-file.txt',
    );
    expect(uploadFromMock).toHaveBeenCalledWith(
      localFile,
      'uuid-file.txt',
    );
  });
});
