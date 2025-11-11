/**
 * DTO for updating an existing role definition.
 * Inherits validation rules from CreateRoleDto but makes all fields optional.
 */
import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateRoleDto } from '@app/core/roles/dto/create-role.dto';
import { RoleName } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateRoleDto extends PartialType(CreateRoleDto) {
  @ApiPropertyOptional({
    enum: RoleName,
    description: 'New role name (enum value) to replace the existing one.',
    example: 'supplier',
  })
  @IsOptional()
  @IsEnum(RoleName, {
    message: 'Invalid role name. Must be a valid RoleName enum value.',
  })
  override name?: RoleName;
}
