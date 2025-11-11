/**
 * DTO for assigning a role to a user.
 * Supports either roleId (UUID) or roleName (enum value).
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { RoleName } from '@prisma/client';

export class AssignRoleDto {
  @ApiProperty({
    format: 'uuid',
    description: 'UUID of the target user who will receive the role.',
    example: 'a97d63b8-1f4e-4c3b-91d8-69f3a9a1a888',
  })
  @IsUUID('4', { message: 'Invalid userId format. Must be a UUID v4.' })
  userId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'UUID of the role to assign (alternative to roleName).',
    example: '67a6dbea-0d3b-4e1e-8aa8-2f6c6df83bb4',
  })
  @ValidateIf((o) => !o.roleName)
  @IsUUID('4', { message: 'Invalid roleId format. Must be a UUID v4.' })
  @IsOptional()
  roleId?: string;

  @ApiPropertyOptional({
    enum: RoleName,
    description:
      'Name of the role to assign (alternative to roleId). Uses Prisma enum values.',
    example: 'admin',
  })
  @ValidateIf((o) => !o.roleId)
  @IsEnum(RoleName, {
    message: 'Invalid roleName. Must be a valid RoleName enum.',
  })
  @IsOptional()
  roleName?: RoleName;
}
