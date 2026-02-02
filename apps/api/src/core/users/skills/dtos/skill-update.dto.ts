// apps/api/src/core/users/skills/dtos/skill-update.dto.ts
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SkillUpdateDto {
  @ApiPropertyOptional({
    description: 'نام فارسی مهارت. فقط اگر لازم شد تغییرش بدهید.',
    example: 'گرافیست',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  nameFa?: string;

  @ApiPropertyOptional({
    description: 'نام انگلیسی مهارت (اختیاری).',
    example: 'Graphic Designer',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  nameEn?: string;

  @ApiPropertyOptional({
    description: 'توضیح مهارت (اختیاری).',
    example: 'مهارت در طراحی پوستر و هویت بصری.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
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
  @IsInt()
  sortOrder?: number;
}
