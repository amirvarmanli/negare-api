/**
 * UsersModule exposes user CRUD services/controllers for the core domain.
 */
import { Module } from '@nestjs/common';
import { UsersController } from '@app/core/users/users.controller';
import { UsersService } from '@app/core/users/users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
