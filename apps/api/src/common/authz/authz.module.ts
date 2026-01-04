import { Global, Module } from '@nestjs/common';
import { PermissionsService } from '@app/common/authz/permissions.service';
import { PermissionsGuard } from '@app/common/guards/permissions.guard';

@Global()
@Module({
  providers: [PermissionsService, PermissionsGuard],
  exports: [PermissionsService, PermissionsGuard],
})
export class AuthzModule {}
