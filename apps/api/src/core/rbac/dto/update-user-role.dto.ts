import { ApiProperty } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

const ALLOWED_ROLE_VALUES = Object.values(RoleName) as RoleName[];

export class UpdateUserRoleDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @ApiProperty({
    enum: RoleName,
    description: `Allowed values: ${ALLOWED_ROLE_VALUES.join(', ')}`,
  })
  @IsEnum(RoleName, {
    message: `Invalid role. Must be one of: ${ALLOWED_ROLE_VALUES.join(', ')}`,
    context: {
      errorCode: 'INVALID_ROLE',
      allowed: ALLOWED_ROLE_VALUES,
    },
  })
  role!: RoleName;
}
