/**
 * UsersModule exposes user CRUD services/controllers for the core domain.
 */
import { Module } from '@nestjs/common';
import { UsersController } from '@app/core/users/users.controller';
import { UsersService } from '@app/core/users/users.service';

import { SkillsController } from '@app/core/users/skills/skills.controller';
import { SkillsService } from '@app/core/users/skills/skills.service';

@Module({
  controllers: [UsersController, SkillsController],
  providers: [UsersService, SkillsService],
  exports: [UsersService, SkillsService],
})
export class UsersModule {}
