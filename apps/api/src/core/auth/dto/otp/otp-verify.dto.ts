import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  ValidateIf,
  IsEmail,
  IsPhoneNumber,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { OtpChannel, OtpPurpose } from '@prisma/client';

/** نرمال‌سازی شماره ایران به E164 (+989xxxxxxxxx) */
function normalizePhoneIR(raw: string): string {
  if (!raw) return raw as unknown as string;
  let v = String(raw).replace(/\s+/g, '');
  if (/^09\d{9}$/.test(v)) return '+98' + v.slice(1); // 09xxxxxxxxx -> +989xxxxxxxxx
  if (/^9\d{9}$/.test(v)) return '+98' + v; // 9xxxxxxxxx  -> +989xxxxxxxxx
  if (/^0098/.test(v)) return v.replace(/^00/, '+'); // 0098...     -> +98...
  if (/^0\+98/.test(v)) return v.replace(/^0\+/, '+'); // 0+98...     -> +98...
  return v;
}

/**
 * DTO for verifying a previously requested OTP.
 * Used for signup/login/reset verification.
 */
export class VerifyOtpDto {
  @ApiProperty({
    enum: OtpChannel,
    example: OtpChannel.sms,
    description: 'sms | email — باید با درخواست اولیه یکی باشد.',
  })
  @IsEnum(OtpChannel)
  channel!: OtpChannel;

  @ApiProperty({
    example: '09123456789 یا user@example.com',
    description:
      'گیرنده (ایمیل یا موبایل). ایمیل lowercase می‌شود، موبایل به E164 ایران.',
  })
  @IsString()
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
  @IsEmail({}, { message: 'Invalid email format.' })
  @ValidateIf((o) => o.channel === OtpChannel.sms)
  @IsPhoneNumber('IR', { message: 'Invalid phone number format.' })
  identifier!: string;

  @ApiProperty({
    example: '123456',
    description: 'کد ۶ رقمی OTP که برای کاربر ارسال شده است.',
  })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Code must be exactly 6 digits.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  code!: string;

  @ApiProperty({
    enum: OtpPurpose,
    example: OtpPurpose.signup,
    description: 'Purpose (signup | login | reset) — REQUIRED.',
  })
  @IsEnum(OtpPurpose, { message: 'purpose must be one of signup|login|reset' })
  purpose!: OtpPurpose; // ← اجباری
}
