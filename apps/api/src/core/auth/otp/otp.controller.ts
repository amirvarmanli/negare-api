import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  Headers,
  HttpCode,
  UsePipes,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiTooManyRequestsResponse,
  ApiServiceUnavailableResponse,
  ApiBadGatewayResponse,
  ApiGoneResponse,
  ApiBody,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '@app/common/decorators/public.decorator';
import { OtpService } from '@app/core/auth/otp/otp.service';
import { RequestOtpDto } from '@app/core/auth/dto/otp/otp-request.dto';
import { ResendOtpDto } from '@app/core/auth/dto/otp/otp-resend.dto';
import { VerifyOtpDto } from '@app/core/auth/dto/otp/otp-verify.dto';
import type { ValidationError } from 'class-validator';
import { OtpChannel } from '@prisma/client';

function buildOtpValidationException(
  errors: ValidationError[],
): BadRequestException {
  const first = errors[0];
  const firstConstraint = first?.constraints
    ? Object.values(first.constraints)[0]
    : 'Invalid payload.';
  const code =
    first?.property === 'identifier' ? 'INVALID_IDENTIFIER' : 'INVALID_PAYLOAD';

  return new BadRequestException({
    success: false,
    error: {
      code,
      message: firstConstraint ?? 'Invalid payload.',
    },
  });
}

function maskDestination(channel: OtpChannel, identifier: string): string {
  if (channel === OtpChannel.sms) {
    const digits = identifier.replace(/\D/g, '');
    if (digits.length <= 4) return identifier;
    const tail = digits.slice(-4);
    return `+98******${tail}`;
  }

  const [local, domain] = identifier.split('@');
  if (!domain) return identifier;
  if (local.length <= 2) {
    return `${local[0] ?? '*'}*@${domain}`;
  }
  return `${local[0]}***${local.slice(-1)}@${domain}`;
}

@ApiTags('Authentication - OTP')
@Controller('auth/otp')
export class OtpController {
  constructor(private readonly otp: OtpService) {}

  /* ------------------------------------------------------------------ *
   * 1) Request OTP (signup / login / reset)
   * ------------------------------------------------------------------ */
  @Public()
  @Post('request')
  @HttpCode(200)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true, // DTO ها را به enum/نوع درست تبدیل می‌کند
      exceptionFactory: buildOtpValidationException,
    }),
  )
  @ApiOperation({
    summary: 'Request a 6-digit OTP via SMS or Email',
    description:
      'If an active code exists, only cooldown info is returned; otherwise a new OTP is issued and delivered.',
  })
  @ApiBody({
    type: RequestOtpDto,
    examples: {
      sms: {
        summary: 'SMS (default channel)',
        value: {
          identifier: '09123456789',
          channel: 'sms',
          purpose: 'login',
        },
      },
      email: {
        summary: 'Email',
        value: {
          identifier: 'user@example.com',
          channel: 'email',
          purpose: 'register',
        },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      example: {
        ok: true,
        success: true,
        traceId: 'c2c3b9f2-2e5c-4cbb-9a1a-6a6f1f6df2a1',
        cooldownSeconds: 120,
        delivery: { channel: 'sms', maskedTo: '+98******6789' },
        data: { alreadyActive: false, expiresIn: 300, resendAvailableIn: 120 },
      },
    },
  })
  @ApiBadRequestResponse({
    schema: {
      example: {
        success: false,
        error: { code: 'INVALID_IDENTIFIER', message: 'INVALID_MOBILE' },
        traceId: 'c2c3b9f2-2e5c-4cbb-9a1a-6a6f1f6df2a1',
      },
    },
  })
  @ApiConflictResponse({
    description: 'برای signup اگر کاربر از قبل وجود دارد (USER_EXISTS).',
  })
  @ApiTooManyRequestsResponse({
    schema: {
      example: {
        success: false,
        error: {
          code: 'OTP_COOLDOWN',
          message: 'Please wait 40s before requesting a new code.',
          meta: { remainingSeconds: 40 },
        },
        traceId: 'c2c3b9f2-2e5c-4cbb-9a1a-6a6f1f6df2a1',
      },
    },
  })
  @ApiServiceUnavailableResponse({
    schema: {
      example: {
        success: false,
        error: {
          code: 'OTP_PROVIDER_NOT_CONFIGURED',
          message: 'SMS provider is not configured.',
        },
        traceId: 'c2c3b9f2-2e5c-4cbb-9a1a-6a6f1f6df2a1',
      },
    },
  })
  @ApiBadGatewayResponse({
    schema: {
      example: {
        success: false,
        error: {
          code: 'OTP_DELIVERY_FAILED',
          message: 'Failed to send verification code.',
          meta: { provider: 'kavenegar' },
        },
        traceId: 'c2c3b9f2-2e5c-4cbb-9a1a-6a6f1f6df2a1',
      },
    },
  })
  async request(
    @Body() dto: RequestOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') ua?: string,
  ) {
    const traceId = (req as Request & { txId?: string }).txId ?? 'unknown';
    const channel = dto.channel ?? OtpChannel.sms;
    const out = await this.otp.requestOtp(
      channel,
      dto.identifier,
      dto.purpose,
      this.getIp(req),
      ua,
    );

    // UX headers
    if (
      out?.data?.alreadyActive &&
      typeof out.data.resendAvailableIn === 'number' &&
      out.data.resendAvailableIn > 0
    ) {
      res.setHeader('Retry-After', String(out.data.resendAvailableIn));
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Cookie');
    return {
      success: true,
      ok: true,
      traceId,
      cooldownSeconds: out.data.resendAvailableIn,
      delivery: {
        channel,
        maskedTo: maskDestination(channel, dto.identifier),
      },
      data: out.data,
    };
  }

  /* ------------------------------------------------------------------ *
   * 2) Resend active OTP (respects cooldown)
   * ------------------------------------------------------------------ */
  @Public()
  @Post('resend')
  @HttpCode(200)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: buildOtpValidationException,
    }),
  )
  @ApiOperation({
    summary: 'Resend the active OTP (if cooldown passed)',
    description:
      'اگر کد فعال نباشد، رفتار مثل request است؛ اگر کول‌داون تمام نشده باشد، تایمر برگردانده می‌شود.',
  })
  @ApiBody({
    type: ResendOtpDto,
    examples: {
      sms: {
        summary: 'SMS resend',
        value: {
          identifier: '09123456789',
          channel: 'sms',
          purpose: 'login',
        },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      example: {
        ok: true,
        success: true,
        traceId: 'c2c3b9f2-2e5c-4cbb-9a1a-6a6f1f6df2a1',
        cooldownSeconds: 55,
        delivery: { channel: 'sms', maskedTo: '+98******6789' },
        data: { alreadyActive: true, expiresIn: 240, resendAvailableIn: 55 },
      },
    },
  })
  @ApiBadRequestResponse({
    schema: {
      example: {
        success: false,
        error: { code: 'INVALID_IDENTIFIER', message: 'INVALID_MOBILE' },
        traceId: 'c2c3b9f2-2e5c-4cbb-9a1a-6a6f1f6df2a1',
      },
    },
  })
  @ApiTooManyRequestsResponse({
    schema: {
      example: {
        success: false,
        error: {
          code: 'OTP_COOLDOWN',
          message: 'Please wait 40s before requesting a new code.',
          meta: { remainingSeconds: 40 },
        },
        traceId: 'c2c3b9f2-2e5c-4cbb-9a1a-6a6f1f6df2a1',
      },
    },
  })
  @ApiServiceUnavailableResponse({
    schema: {
      example: {
        success: false,
        error: {
          code: 'OTP_PROVIDER_NOT_CONFIGURED',
          message: 'SMS provider is not configured.',
        },
        traceId: 'c2c3b9f2-2e5c-4cbb-9a1a-6a6f1f6df2a1',
      },
    },
  })
  @ApiBadGatewayResponse({
    schema: {
      example: {
        success: false,
        error: {
          code: 'OTP_DELIVERY_FAILED',
          message: 'Failed to send verification code.',
          meta: { provider: 'kavenegar' },
        },
        traceId: 'c2c3b9f2-2e5c-4cbb-9a1a-6a6f1f6df2a1',
      },
    },
  })
  async resend(
    @Body() dto: ResendOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') ua?: string,
  ) {
    const traceId = (req as Request & { txId?: string }).txId ?? 'unknown';
    const channel = dto.channel ?? OtpChannel.sms;
    const out = await this.otp.resendOtp(
      channel,
      dto.identifier,
      dto.purpose,
      this.getIp(req),
      ua,
    );

    if (
      out?.data?.alreadyActive &&
      typeof out.data.resendAvailableIn === 'number' &&
      out.data.resendAvailableIn > 0
    ) {
      res.setHeader('Retry-After', String(out.data.resendAvailableIn));
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Cookie');
    return {
      success: true,
      ok: true,
      traceId,
      cooldownSeconds: out.data.resendAvailableIn,
      delivery: {
        channel,
        maskedTo: maskDestination(channel, dto.identifier),
      },
      data: out.data,
    };
  }

  /* ------------------------------------------------------------------ *
   * 3) Verify OTP and issue ticket (JWT)
   * ------------------------------------------------------------------ */
  @Public()
  @Post('verify')
  @HttpCode(200)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: buildOtpValidationException,
    }),
  )
  @ApiOperation({
    summary: 'Verify 6-digit OTP and return a temporary JWT ticket',
    description:
      'پس از موفقیت، تیکت یک‌بارمصرف برای مرحله بعد (set/reset password) صادر می‌شود.',
  })
  @ApiBody({
    type: VerifyOtpDto,
    examples: {
      sms: {
        summary: 'Verify OTP',
        value: {
          identifier: '09123456789',
          channel: 'sms',
          purpose: 'login',
          code: '123456',
        },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      example: {
        ok: true,
        success: true,
        traceId: 'c2c3b9f2-2e5c-4cbb-9a1a-6a6f1f6df2a1',
        data: {
          ticket: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          next: 'set-password',
          expiresIn: 600,
        },
      },
    },
  })
  @ApiBadRequestResponse({
    schema: {
      example: {
        success: false,
        error: { code: 'OTP_INVALID_CODE', message: 'Invalid code.' },
        traceId: 'c2c3b9f2-2e5c-4cbb-9a1a-6a6f1f6df2a1',
      },
    },
  })
  @ApiGoneResponse({
    schema: {
      example: {
        success: false,
        error: { code: 'OTP_EXPIRED', message: 'Code expired.' },
        traceId: 'c2c3b9f2-2e5c-4cbb-9a1a-6a6f1f6df2a1',
      },
    },
  })
  @ApiTooManyRequestsResponse({
    schema: {
      example: {
        success: false,
        error: {
          code: 'OTP_TOO_MANY_ATTEMPTS',
          message: 'Too many attempts. Try again later.',
        },
        traceId: 'c2c3b9f2-2e5c-4cbb-9a1a-6a6f1f6df2a1',
      },
    },
  })
  async verify(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') ua?: string,
  ) {
    const traceId = (req as Request & { txId?: string }).txId ?? 'unknown';
    const channel = dto.channel ?? OtpChannel.sms;
    const out = await this.otp.verifyOtp(
      channel,
      dto.identifier,
      dto.code,
      dto.purpose,
      this.getIp(req),
      ua,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Cookie');
    return {
      success: true,
      ok: true,
      traceId,
      data: out.data,
    };
  }

  /* ----------------------------- helper ----------------------------- */
  private getIp(req: Request): string | undefined {
    const ip =
      (req.headers['cf-connecting-ip'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      (Array.isArray(req.ips) && req.ips.length > 0 && req.ips[0]) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress;
    return ip || undefined;
  }
}
