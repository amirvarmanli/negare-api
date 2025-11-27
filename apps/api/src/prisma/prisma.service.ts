import {
  INestApplication,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService (Prisma 6.x compatible)
 * Standard NestJS wrapper around PrismaClient
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication): Promise<void> {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}

/**
 * Proper transaction client type for Prisma 6.x
 *
 * Prisma’s $transaction callback receives an instance of PrismaClient
 * with the ITXClientDenyList removed.
 */
export type PrismaTxClient = Parameters<
  Parameters<PrismaService['$transaction']>[0]
>[0];
