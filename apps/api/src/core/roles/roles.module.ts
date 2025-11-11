/**
 * RolesModule exposes the role controller/service for RBAC administration.
 */
import { Module } from '@nestjs/common';
import { RolesController } from '@app/core/roles/roles.controller';
import { RolesService } from '@app/core/roles/roles.service';
import { UserRolesController } from '@app/core/roles/user-roles.controller';
import { UserRolesService } from '@app/core/roles/user-roles.service';

@Module({
  controllers: [RolesController, UserRolesController],
  providers: [RolesService, UserRolesService],
  exports: [RolesService, UserRolesService],
})
export class RolesModule {}
