/**
 * DTO for filtering user–role assignments in administrative queries.
 * Supports filtering by userId, roleId, or roleName.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class FindUserRolesQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filter results by target user UUID.',
    example: '3b797f02-91f8-4d81-8bad-abb197690ecd',
  })
  @IsOptional()
  @IsUUID('4', { message: 'userId must be a valid UUID v4.' })
  userId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filter results by role UUID.',
    example: 'a4e66398-75ab-4909-9c65-58ac4d99be3b',
  })
  @IsOptional()
  @IsUUID('4', { message: 'roleId must be a valid UUID v4.' })
  roleId?: string;

  @ApiPropertyOptional({
    enum: RoleName,
    description: 'Filter results by role name (enum value).',
    example: 'admin',
  })
  @IsOptional()
  @IsEnum(RoleName, {
    message: 'roleName must be a valid RoleName enum value.',
  })
  roleName?: RoleName;
}
