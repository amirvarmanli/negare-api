import { Module } from '@nestjs/common';
import { AdminRbacController } from '@app/core/rbac/admin-rbac.controller';
import { AdminRbacService } from '@app/core/rbac/admin-rbac.service';

@Module({
  controllers: [AdminRbacController],
  providers: [AdminRbacService],
  exports: [AdminRbacService],
})
export class AdminRbacModule {}
