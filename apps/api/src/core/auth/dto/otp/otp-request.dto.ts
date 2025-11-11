import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  ValidateIf,
  IsEmail,
  IsPhoneNumber,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { OtpChannel, OtpPurpose } from '@prisma/client';

function normalizePhoneIR(raw: string): string {
  if (!raw) return raw;
  let v = String(raw).replace(/\s+/g, '');
  // 09xxxxxxxxx  -> +989xxxxxxxxx
  if (/^09\d{9}$/.test(v)) return '+98' + v.slice(1);
  // 9xxxxxxxxx   -> +989xxxxxxxxx
  if (/^9\d{9}$/.test(v)) return '+98' + v;
  // 0098... -> +98...
  if (/^0098/.test(v)) return v.replace(/^00/, '+');
  // 0+98... (حالات عجیب) -> +98...
  if (/^0\+98/.test(v)) return v.replace(/^0\+/, '+');
  return v;
}

export class RequestOtpDto {
  @ApiProperty({
    enum: OtpChannel,
    example: OtpChannel.sms,
    description: 'sms | email',
  })
  @IsEnum(OtpChannel)
  channel!: OtpChannel;

  @ApiProperty({
    example: 'user@example.com یا 09123456789',
    description:
      'ایمیل یا موبایل (بسته به channel). ایمیل lowercase می‌شود؛ موبایل به E164 ایران نرمال می‌شود.',
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
  @IsPhoneNumber('IR', { message: 'Invalid phone number.' })
  identifier!: string;

  @ApiProperty({
    enum: OtpPurpose,
    example: OtpPurpose.signup,
    description: 'Purpose of OTP (signup, login, reset) — REQUIRED',
  })
  @IsEnum(OtpPurpose, { message: 'purpose must be one of signup|login|reset' })
  purpose!: OtpPurpose; // ⬅️ اجباری
}
