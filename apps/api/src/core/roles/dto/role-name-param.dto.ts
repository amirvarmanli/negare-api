/**
 * DTO validating the `name` route parameter for role-related endpoints.
 * Ensures that the provided name is a valid RoleName enum value.
 */
import { ApiProperty } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class RoleNameParamDto {
  @ApiProperty({
    enum: RoleName,
    description:
      'Role name parameter (must match one of the RoleName enum values).',
    example: 'admin',
  })
  @IsEnum(RoleName, {
    message: 'Invalid role name. Must be a valid RoleName enum value.',
  })
  name!: RoleName;
}
