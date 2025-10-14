import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FakeAuthGuard } from './guards/fake-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  providers: [
    FakeAuthGuard,
    {
      provide: APP_GUARD,
      useClass: FakeAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AuthModule {}
