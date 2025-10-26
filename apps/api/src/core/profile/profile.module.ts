/**
 * ProfileModule bundles the profile controller/service and required dependencies.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { User } from '@app/core/users/user.entity';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [ProfileController],
  providers: [ProfileService, JwtAuthGuard],
  exports: [ProfileService],
})
/**
 * Nest module exposing profile services for other modules that require profile lookups.
 */
export class ProfileModule {}
