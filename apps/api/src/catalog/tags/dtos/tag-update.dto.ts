import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateTagDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 255)
  @Matches(/^[\p{L}\p{N}\s_-]+$/u, {
    message: 'Tag name can only contain letters, numbers, spaces, _ or -',
  })
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 255)
  slug?: string;
}
