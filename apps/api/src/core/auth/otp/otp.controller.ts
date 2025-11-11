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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '@app/common/decorators/public.decorator';
import { OtpService } from '@app/core/auth/otp/otp.service';
import { RequestOtpDto } from '@app/core/auth/dto/otp/otp-request.dto';
import { ResendOtpDto } from '@app/core/auth/dto/otp/otp-resend.dto';
import { VerifyOtpDto } from '@app/core/auth/dto/otp/otp-verify.dto';

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
    }),
  )
  @ApiOperation({
    summary: 'Request a 6-digit OTP via SMS or Email',
    description:
      'اگر کد فعال باشد، فقط تایمرها برمی‌گردند؛ وگرنه کد جدید صادر و ارسال می‌شود.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        success: true,
        data: {
          alreadyActive: false,
          expiresIn: 300,
          resendAvailableIn: 120,
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'در حالت‌های ورودی نامعتبر، یا برای login/reset وقتی کاربر وجود ندارد (USER_NOT_FOUND).',
  })
  @ApiConflictResponse({
    description: 'برای signup اگر کاربر از قبل وجود دارد (USER_EXISTS).',
  })
  @ApiTooManyRequestsResponse({
    description: 'ریفریش/ورودی بیش از حد (ریتلجیک).',
  })
  async request(
    @Body() dto: RequestOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') ua?: string,
  ) {
    // ⚠️ هیچ fallback برای purpose نگذار؛ ValidationPipe تضمین می‌کند معتبر/حاضر باشد
    const out = await this.otp.requestOtp(
      dto.channel,
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
    return out;
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
    }),
  )
  @ApiOperation({
    summary: 'Resend the active OTP (if cooldown passed)',
    description:
      'اگر کد فعال نباشد، رفتار مثل request است؛ اگر کول‌داون تمام نشده باشد، تایمر برگردانده می‌شود.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        success: true,
        data: {
          alreadyActive: true,
          expiresIn: 240,
          resendAvailableIn: 55,
        },
      },
    },
  })
  async resend(
    @Body() dto: ResendOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') ua?: string,
  ) {
    const out = await this.otp.resendOtp(
      dto.channel,
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
    return out;
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
    }),
  )
  @ApiOperation({
    summary: 'Verify 6-digit OTP and return a temporary JWT ticket',
    description:
      'پس از موفقیت، تیکت یک‌بارمصرف برای مرحله بعد (set/reset password) صادر می‌شود.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        success: true,
        data: {
          ticket: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          next: 'set-password',
          expiresIn: 600,
        },
      },
    },
  })
  async verify(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') ua?: string,
  ) {
    const out = await this.otp.verifyOtp(
      dto.channel,
      dto.identifier,
      dto.code,
      dto.purpose,
      this.getIp(req),
      ua,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Cookie');
    return out;
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
