import { Module } from '@nestjs/common';
import { MediaService } from '@app/core/media/media.service';
import { PrismaModule } from '@app/prisma/prisma.module';

@Module({
  imports: [PrismaModule], 
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
