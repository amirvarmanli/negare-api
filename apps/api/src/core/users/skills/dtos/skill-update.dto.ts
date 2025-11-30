// apps/api/src/core/users/skills/dtos/skill-update.dto.ts
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SkillUpdateDto {
  @ApiPropertyOptional({
    description: 'کلید یکتا برای مهارت. فقط در صورت نیاز به تغییر ارسال شود.',
    example: 'GRAPHIC_DESIGNER',
    maxLength: 64,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  key?: string;

  @ApiPropertyOptional({
    description: 'نام فارسی مهارت. فقط اگر لازم شد تغییرش بدهید.',
    example: 'گرافیست',
    maxLength: 255,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nameFa?: string;

  @ApiPropertyOptional({
    description: 'نام انگلیسی مهارت (اختیاری).',
    example: 'Graphic Designer',
    maxLength: 255,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nameEn?: string;

  @ApiPropertyOptional({
    description: 'توضیح مهارت (اختیاری).',
    example: 'مهارت در طراحی پوستر و هویت بصری.',
    maxLength: 1000,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description:
      'فعال یا غیرفعال بودن مهارت. اگر مقدار داده نشود تغییر نمی‌کند.',
    example: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'ترتیب نمایش مهارت در لیست‌ها. مقدار کمتر یعنی نمایش بالاتر.',
    example: 5,
    nullable: true,
    type: Number,
  })
  @IsOptional()
  sortOrder?: number;
}
