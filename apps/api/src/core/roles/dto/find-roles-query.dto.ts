/**
 * DTO for querying and filtering role records.
 * Supports filtering by enum name and limiting page size.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsInt, Max, Min } from 'class-validator';

export class FindRolesQueryDto {
  @ApiPropertyOptional({
    enum: RoleName,
    description: 'Filter results by specific role name (optional).',
    example: 'admin',
  })
  @IsOptional()
  @IsEnum(RoleName, {
    message: 'Invalid role name. Must be a valid RoleName enum value.',
  })
  name?: RoleName;

  @ApiPropertyOptional({
    type: Number,
    default: 25,
    minimum: 1,
    maximum: 100,
    description: 'Maximum number of roles to return (1–100). Default is 25.',
    example: 25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer number.' })
  @Min(1, { message: 'Limit must be at least 1.' })
  @Max(100, { message: 'Limit cannot exceed 100.' })
  limit?: number = 25;
}
