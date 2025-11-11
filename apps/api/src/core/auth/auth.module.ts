import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { HybridAuthGuard } from '@app/core/auth/guards/hybrid-auth.guard';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@app/common/guards/roles.guard';
import { SmsModule } from '@app/sms/sms.module';
import { MailModule } from '@app/mail/mail.module';
import { RedisModule } from '@app/redis/redis.module';
import { UsersModule } from '@app/core/users/users.module';
import { TokenModule } from '@app/core/auth/token/token.module';

// Controllers
import { AuthController } from '@app/core/auth/auth.controller';
import { OtpController } from '@app/core/auth/otp/otp.controller';
import { PasswordController } from '@app/core/auth/password/password.controller';

// Services
import { OtpService } from '@app/core/auth/otp/otp.service';
import { OtpRateLimitService } from '@app/core/auth/otp/otp-rate-limit.service';
import { PasswordService } from '@app/core/auth/password/password.service';
import { RefreshService } from '@app/core/auth/refresh.service';
import { SessionService } from '@app/core/auth/session/session.service';
import { RefreshRateLimitService } from '@app/core/auth/refresh-rate-limit.service';

// NEW
import { PrismaService } from '@app/prisma/prisma.service';
import { UserLookupProvider } from '@app/core/auth/otp/user-lookup.provider';

@Module({
  imports: [SmsModule, MailModule, RedisModule, UsersModule, TokenModule],
  controllers: [AuthController, OtpController, PasswordController],
  providers: [
    PrismaService, // ← اضافه
    UserLookupProvider, // ← اضافه

    OtpService,
    PasswordService,
    RefreshService,
    RefreshRateLimitService,
    OtpRateLimitService,
    HybridAuthGuard,
    JwtAuthGuard,
    SessionService,
    { provide: 'LEGACY_PASSWORD_ADAPTER', useValue: null },

    {
      provide: 'AuditService',
      useValue: { log: async () => void 0 },
    },
    {
      provide: APP_GUARD,
      useClass: HybridAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [
    OtpService,
    PasswordService,
    RefreshService,
    JwtAuthGuard,
    SessionService,
  ],
})
export class AuthModule {}
