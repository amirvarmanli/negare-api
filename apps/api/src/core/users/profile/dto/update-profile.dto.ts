/**
 * DTO representing allowed profile mutations for authenticated users.
 * Clean, null-safe, validation-safe, and optimized for both Swagger & Prisma.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  // ───────────────────────────────
  // Display Name
  // ───────────────────────────────
  @ApiPropertyOptional({
    example: 'امیرحسین ورمانلی',
    description: 'نام کامل نمایش داده‌شده در پروفایل. خالی یا null = حذف.',
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string | null;

  // ───────────────────────────────
  // Bio
  // ───────────────────────────────
  @ApiPropertyOptional({
    example: 'گرافیست و تصویرساز دیجیتال با تمرکز روی سبک نئونی.',
    description: 'بیو کوتاه کاربر. خالی یا null = حذف.',
    maxLength: 400,
  })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  bio?: string | null;

  // ───────────────────────────────
  // City
  // ───────────────────────────────
  @ApiPropertyOptional({
    example: 'Tehran',
    description: 'شهر محل فعالیت کاربر.',
    maxLength: 60,
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string | null;

  // ───────────────────────────────
  // Avatar URL
  // ───────────────────────────────
  @ApiPropertyOptional({
    example: 'https://cdn.negare.com/u/avatars/123.png',
    description: 'URL کامل تصویر پروفایل. null = حذف آواتار.',
  })
  @ValidateIf((o) => o.avatarUrl !== null && o.avatarUrl !== undefined)
  @IsOptional()
  @IsUrl(
    { require_protocol: true },
    { message: 'فرمت آدرس آواتار معتبر نیست (باید با https:// شروع شود).' },
  )
  avatarUrl?: string | null;

  // ───────────────────────────────
  // Email Blocked
  // ───────────────────────────────
  @ApiPropertyOptional({
    example: 'new-email@example.com',
    description:
      'تغییر ایمیل فقط از طریق فرآیند OTP قابل انجام است. این فیلد در این endpoint بلاک است.',
  })
  @IsOptional()
  @IsEmpty({
    message: 'تغییر ایمیل در این مسیر مجاز نیست. از روش OTP استفاده کنید.',
  })
  email?: string | null;

  // ───────────────────────────────
  // Phone Blocked
  // ───────────────────────────────
  @ApiPropertyOptional({
    example: '09123456789',
    description:
      'تغییر شماره تلفن از این endpoint امکان‌پذیر نیست. از OTP استفاده کنید.',
  })
  @IsOptional()
  @IsEmpty({
    message: 'تغییر شماره تلفن در این endpoint مجاز نیست.',
  })
  phone?: string | null;

  // ───────────────────────────────
  // Skills (Only for supplier accounts)
  // ───────────────────────────────
  @ApiPropertyOptional({
    example: [
      '7f3d93c4-52ed-4187-8d58-aa8f18bd21b6',
      '3f7e1e28-83b1-4ab6-ad3e-393b102f7b44',
    ],
    description:
      'لیست مهارت‌های انتخاب‌شده توسط کاربر Supplier. مقدار null = بدون تغییر، آرایه خالی = حذف همه.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  skillIds?: string[] | null;
}
