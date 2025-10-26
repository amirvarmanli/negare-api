import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class ToggleBookmarkDto {
  @ApiPropertyOptional({
    description:
      'Desired bookmark state. Omit the property to toggle the current state.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  bookmarked?: boolean;
}
