import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma/prisma.module';
import { BlogService } from '@app/blog/blog.service';
import { BlogController } from '@app/blog/blog.controller';
import { BlogAdminController } from '@app/blog/blog-admin.controller';

@Module({
  imports: [PrismaModule],
  controllers: [BlogController, BlogAdminController],
  providers: [BlogService],
  exports: [BlogService],
})
export class BlogModule {}
