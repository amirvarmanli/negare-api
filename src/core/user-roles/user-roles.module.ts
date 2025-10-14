import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserRole } from './user-role.entity';
import { UserRolesController } from './user-roles.controller';
import { UserRolesService } from './user-roles.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserRole])],
  controllers: [UserRolesController],
  providers: [UserRolesService],
  exports: [UserRolesService, TypeOrmModule],
})
export class UserRolesModule {}
