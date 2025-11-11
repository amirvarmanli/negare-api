/**
 * DTO for creating new role definitions.
 * Wraps a single enum-backed name property.
 */
import { ApiProperty } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({
    enum: RoleName,
    description: 'Predefined role name from the RoleName enum.',
    example: 'admin',
  })
  @IsEnum(RoleName, {
    message: 'Invalid role name. Must be one of the RoleName enum values.',
  })
  name!: RoleName;
}
