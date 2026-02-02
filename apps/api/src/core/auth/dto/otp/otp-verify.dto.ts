import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  ValidateIf,
  IsEmail,
  Matches,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { OtpChannel, OtpPurpose } from '@prisma/client';

/** نرمال‌سازی شماره ایران به E164 (+989xxxxxxxxx) */
function normalizePhoneIR(raw: string): string {
  if (!raw) return raw as unknown as string;
  let v = String(raw).replace(/\s+/g, '');
  if (/^09\d{9}$/.test(v)) return '+98' + v.slice(1); // 09xxxxxxxxx -> +989xxxxxxxxx
  return v;
}

/**
 * DTO for verifying a previously requested OTP.
 * Used for signup/login/reset verification.
 */
export class VerifyOtpDto {
  @ApiPropertyOptional({
    enum: OtpChannel,
    example: OtpChannel.sms,
    description: 'sms | email — باید با درخواست اولیه یکی باشد (default: sms).',
  })
  @IsOptional()
  @IsEnum(OtpChannel, { message: 'INVALID_CHANNEL' })
  channel: OtpChannel = OtpChannel.sms;

  @ApiProperty({
    example: '09123456789 یا user@example.com',
    description:
      'گیرنده (ایمیل یا موبایل). ایمیل lowercase می‌شود، موبایل به E164 ایران.',
  })
  @IsNotEmpty({ message: 'IDENTIFIER_REQUIRED' })
  @IsString({ message: 'IDENTIFIER_REQUIRED' })
  @Transform(({ value, obj }) => {
    if (obj?.channel === OtpChannel.email && typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    if (obj?.channel === OtpChannel.sms && typeof value === 'string') {
      return normalizePhoneIR(value);
    }
    return value;
  })
  @ValidateIf((o) => o.channel === OtpChannel.email)
  @IsEmail({}, { message: 'INVALID_EMAIL' })
  @ValidateIf((o) => o.channel === OtpChannel.sms)
  @Matches(/^(?:\+98|0)9\d{9}$/, { message: 'INVALID_MOBILE' })
  identifier!: string;

  @ApiProperty({
    example: '123456',
    description: 'کد ۶ رقمی OTP که برای کاربر ارسال شده است.',
  })
  @IsNotEmpty({ message: 'OTP_CODE_REQUIRED' })
  @IsString({ message: 'OTP_CODE_REQUIRED' })
  @Matches(/^\d{6}$/, { message: 'INVALID_OTP_CODE' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  code!: string;

  @ApiPropertyOptional({
    enum: ['login', 'register', 'reset_password'],
    example: 'login',
    description:
      'Purpose (login | register | reset_password) — default: login.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    if (value === 'register') return OtpPurpose.signup;
    if (value === 'reset_password') return OtpPurpose.reset;
    return value;
  })
  @IsEnum(OtpPurpose, { message: 'INVALID_PURPOSE' })
  purpose: OtpPurpose = OtpPurpose.login;
}
