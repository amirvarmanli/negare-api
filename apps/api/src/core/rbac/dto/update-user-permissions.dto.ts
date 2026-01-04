import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateUserPermissionsDto {
  @ApiPropertyOptional({
    type: () => [String],
    example: ['admin.blog:manage', 'admin.newsletter:manage'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  add?: string[];

  @ApiPropertyOptional({
    type: () => [String],
    example: ['admin.products:manage'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  remove?: string[];
}
