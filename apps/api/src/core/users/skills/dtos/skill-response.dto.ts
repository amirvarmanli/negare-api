import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SkillDto {
  @ApiProperty({
    description: 'شناسه یکتا برای مهارت.',
    example: 'f2d7a2e4-9e5a-4e2c-b19b-38e1c4df5501',
  })
  id: string;

  @ApiProperty({
    description:
      'کلید یکتا برای استفاده در سیستم (فیلتر، UI، یا نام ثابت). بهتر است انگلیسی و ثابت باشد.',
    example: 'GRAPHIC_DESIGNER',
  })
  key: string;

  @ApiProperty({
    description: 'نام فارسی مهارت برای نمایش در پنل و صفحات.',
    example: 'گرافیست',
  })
  nameFa: string;

  @ApiPropertyOptional({
    description: 'نام انگلیسی مهارت (اختیاری).',
    example: 'Graphic Designer',
    nullable: true,
  })
  nameEn?: string | null;

  @ApiPropertyOptional({
    description: 'توضیح مهارت (اختیاری).',
    example: 'طراحی پوستر، هویت بصری و گرافیک تبلیغاتی.',
    nullable: true,
  })
  description?: string | null;

  @ApiProperty({
    description: 'وضعیت فعال بودن مهارت.',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description:
      'ترتیب نمایش مهارت در لیست. اعداد کوچک‌تر بالاتر نمایش داده می‌شوند.',
    example: 10,
  })
  sortOrder: number;
}

export class SkillListResultDto {
  @ApiProperty({
    description: 'لیست مهارت‌ها (DTO کامل).',
    type: [SkillDto],
  })
  items: SkillDto[];
}
