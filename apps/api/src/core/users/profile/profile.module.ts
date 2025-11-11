/**
 * ProfileModule bundles the profile controller/service and required dependencies.
 */
import { Module } from '@nestjs/common';
import { ProfileController } from '@app/core/users/profile/profile.controller';
import { ProfileService } from '@app/core/users/profile/profile.service';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { NoCacheInterceptor } from '@app/common/interceptors/no-cache.interceptor';

@Module({
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
/**
 * Nest module exposing profile services for other modules that require profile lookups.
 */
export class ProfileModule {}
