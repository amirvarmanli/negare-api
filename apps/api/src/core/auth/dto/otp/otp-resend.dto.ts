import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsEmail,
  ValidateIf,
  IsPhoneNumber,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { OtpChannel, OtpPurpose } from '@prisma/client';

/** نرمال‌سازی شماره ایران به E164 (+989xxxxxxxxx) */
function normalizePhoneIR(raw: string): string {
  if (!raw) return raw;
  let v = String(raw).replace(/\s+/g, '');
  if (/^09\d{9}$/.test(v)) return '+98' + v.slice(1); // 09xxxxxxxxx -> +989xxxxxxxxx
  if (/^9\d{9}$/.test(v)) return '+98' + v; // 9xxxxxxxxx  -> +989xxxxxxxxx
  if (/^0098/.test(v)) return v.replace(/^00/, '+'); // 0098...     -> +98...
  if (/^0\+98/.test(v)) return v.replace(/^0\+/, '+'); // 0+98...     -> +98...
  return v;
}

/**
 * DTO for resending an OTP code.
 * Must match the channel/identifier used in the original request.
 */
export class ResendOtpDto {
  @ApiProperty({
    enum: OtpChannel,
    example: OtpChannel.sms,
    description: 'sms | email',
  })
  @IsEnum(OtpChannel)
  channel!: OtpChannel;

  @ApiProperty({
    example: '09123456789 یا user@example.com',
    description:
      'گیرنده (ایمیل یا موبایل). براساس channel اعتبارسنجی می‌شود. ایمیل lowercase و موبایل E164 می‌شود.',
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
    enum: OtpPurpose,
    example: OtpPurpose.signup,
    description: 'Purpose of OTP (signup, login, reset) — REQUIRED',
  })
  @IsEnum(OtpPurpose, { message: 'purpose must be one of signup|login|reset' })
  purpose!: OtpPurpose; // ⬅️ اجباری
}
