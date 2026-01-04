/**
 * UsersModule exposes user CRUD services/controllers for the core domain.
 */
import { Module } from '@nestjs/common';
import { UsersController } from '@app/core/users/users.controller';
import { UsersService } from '@app/core/users/users.service';
import { AdminUsersController } from '@app/core/users/admin/admin-users.controller';
import { AdminUsersService } from '@app/core/users/admin/admin-users.service';

import { SkillsController } from '@app/core/users/skills/skills.controller';
import { SkillsService } from '@app/core/users/skills/skills.service';

@Module({
  controllers: [UsersController, SkillsController, AdminUsersController],
  providers: [UsersService, SkillsService, AdminUsersService],
  exports: [UsersService, SkillsService, AdminUsersService],
})
export class UsersModule {}
