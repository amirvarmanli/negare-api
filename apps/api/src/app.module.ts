import { Module } from '@nestjs/common';
import { CoreModule } from '@app/core/core.module';
import { HealthModule } from '@app/health/health.module';
import { NotificationsModule } from '@app/notifications/notifications.module';
import { CatalogModule } from '@app/catalog/catalog.module';
import { AppConfigModule } from '@app/config/config.module';
import { PrismaModule } from '@app/prisma/prisma.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    NotificationsModule,
    HealthModule,
    CoreModule,
    CatalogModule,
  ],
})
export class AppModule {}
