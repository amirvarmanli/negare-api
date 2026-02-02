import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  ValidateIf,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { OtpChannel, OtpPurpose } from '@prisma/client';

function normalizePhoneIR(raw: string): string {
  if (!raw) return raw;
  let v = String(raw).replace(/\s+/g, '');
  // 09xxxxxxxxx  -> +989xxxxxxxxx
  if (/^09\d{9}$/.test(v)) return '+98' + v.slice(1);
  return v;
}

export class RequestOtpDto {
  @ApiPropertyOptional({
    enum: OtpChannel,
    example: OtpChannel.sms,
    description: 'sms | email (default: sms)',
  })
  @IsOptional()
  @IsEnum(OtpChannel, { message: 'INVALID_CHANNEL' })
  channel: OtpChannel = OtpChannel.sms;

  @ApiProperty({
    example: 'user@example.com یا 09123456789',
    description:
      'ایمیل یا موبایل (بسته به channel). ایمیل lowercase می‌شود؛ موبایل به E164 ایران نرمال می‌شود.',
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

  @ApiPropertyOptional({
    enum: ['login', 'register', 'reset_password'],
    example: 'login',
    description:
      'Purpose of OTP (login | register | reset_password) — default: login',
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
