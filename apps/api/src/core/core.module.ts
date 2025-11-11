import { Module } from '@nestjs/common';
import { AuthModule } from '@app/core/auth/auth.module';
import { ProfileModule } from '@app/core/users/profile/profile.module';
import { RolesModule } from '@app/core/roles/roles.module';
import { UsersModule } from '@app/core/users/users.module';
import { UploadModule } from '@app/core/upload/upload.module';

@Module({
  imports: [AuthModule, ProfileModule, RolesModule, UsersModule, UploadModule],
  exports: [AuthModule, ProfileModule, RolesModule, UsersModule, UploadModule],
})
export class CoreModule {}
