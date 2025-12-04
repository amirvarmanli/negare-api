import { Module } from '@nestjs/common';
import { CoreModule } from '@app/core/core.module';
import { HealthModule } from '@app/health/health.module';
import { NotificationsModule } from '@app/notifications/notifications.module';
import { CatalogModule } from '@app/catalog/catalog.module';
import { ArtistModule } from '@app/catalog/artist/artist.module';
import { AppConfigModule } from '@app/config/config.module';
import { PrismaModule } from '@app/prisma/prisma.module';
import { BlogModule } from '@app/blog/blog.module';
import { NewsletterModule } from '@app/newsletter/newsletter.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    NotificationsModule,
    HealthModule,
    CoreModule,
    CatalogModule,
    ArtistModule,
    BlogModule,
    NewsletterModule,
  ],
})
export class AppModule {}
