import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateTagDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 255)
  @Matches(/^[^#,،\n]+$/u, {
    message: 'تگ نباید شامل # یا ویرگول باشد.',
  })
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 255)
  slug?: string;
}
