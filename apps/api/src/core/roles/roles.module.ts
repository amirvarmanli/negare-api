/**
 * RolesModule exposes the role controller/service for RBAC administration.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { UserRolesController } from './user-roles.controller';
import { UserRolesService } from './user-roles.service';
import { Role } from '@app/core/roles/entities/role.entity';
import { UserRole } from '@app/core/roles/entities/user-role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Role, UserRole])],
  controllers: [RolesController, UserRolesController],
  providers: [RolesService, UserRolesService],
  exports: [RolesService, UserRolesService, TypeOrmModule],
})
/**
 * Nest module bundling the roles catalog for injection across the application.
 */
export class RolesModule {}
