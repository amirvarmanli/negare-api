// apps/api/src/core/users/skills/dtos/skill-create.dto.ts
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SkillCreateDto {
  @ApiProperty({
    description:
      'کلید یکتا برای مهارت. بهتره به صورت ثابت و انگلیسی/اسنیک‌کیس باشه تا بعداً برای فیلتر و نمایش استفاده بشه.',
    example: 'GRAPHIC_DESIGNER',
    maxLength: 64,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  key: string; // مثال: GRAPHIC_DESIGNER

  @ApiProperty({
    description:
      'عنوان فارسی مهارت که در پنل و صفحه هنرمندان نمایش داده می‌شود.',
    example: 'گرافیست',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nameFa: string; // مثال: گرافیست

  @ApiPropertyOptional({
    description: 'عنوان انگلیسی مهارت (اختیاری) برای استفاده در UI یا فیلترها.',
    example: 'Graphic Designer',
    maxLength: 255,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nameEn?: string;

  @ApiPropertyOptional({
    description:
      'توضیح کوتاه در مورد مهارت. برای نمایش در پنل مدیریت یا توضیح بیشتر در مورد نوع مهارت.',
    example: 'طراحی پوستر، بنر، هویت بصری و گرافیک تبلیغاتی.',
    maxLength: 1000,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description:
      'وضعیت فعال بودن مهارت. اگر مقدار داده نشود، به صورت پیش‌فرض روی true تنظیم می‌شود.',
    example: true,
    default: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'ترتیب نمایش مهارت‌ها در لیست‌ها (هرچه عدد کمتر، بالاتر نمایش داده می‌شود). اگر مقدار داده نشود، 0 در نظر گرفته می‌شود.',
    example: 10,
    nullable: true,
    type: Number,
  })
  @IsOptional()
  sortOrder?: number;
}
