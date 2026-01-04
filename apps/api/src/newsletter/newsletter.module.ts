import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma/prisma.module';
import { NewsletterService } from '@app/newsletter/newsletter.service';
import { NewsletterController } from '@app/newsletter/newsletter.controller';
import { NewsletterAdminController } from '@app/newsletter/newsletter-admin.controller';
import { AdminNewslettersController } from '@app/newsletter/admin-newsletters.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    NewsletterController,
    NewsletterAdminController,
    AdminNewslettersController,
  ],
  providers: [NewsletterService],
  exports: [NewsletterService],
})
export class NewsletterModule {}
