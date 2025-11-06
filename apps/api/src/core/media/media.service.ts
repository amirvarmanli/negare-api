import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';

export type CreateFileInput = {
  userId: string;
  filename: string;
  mime: string;
  size: bigint;
  path: string;
  url: string; // absolute CDN url
  status?: 'pending' | 'uploaded' | 'failed';
};

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist uploaded file metadata into database.
   * Called by UploadService.finish() after successful storage upload.
   */
  async createFile(input: CreateFileInput) {
    try {
      const created = await this.prisma.file.create({
        data: {
          userId: input.userId,
          filename: input.filename,
          mime: input.mime,
          size: input.size,
          path: input.path,
          url: input.url,
          status: input.status ?? 'uploaded',
        },
      });
      this.logger.debug(`Media file saved: ${created.id} (${input.filename})`);
      return created;
    } catch (err) {
      this.logger.error(
        `Failed to create media record: ${(err as Error).message}`,
      );
      throw new InternalServerErrorException('failed to create media record');
    }
  }

  /**
   * Fetch single file by id.
   */
  async getFile(id: string) {
    return this.prisma.file.findUnique({ where: { id } });
  }

  /**
   * Optional: list all files of a user (useful for dashboards).
   */
  async listUserFiles(userId: string) {
    return this.prisma.file.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
