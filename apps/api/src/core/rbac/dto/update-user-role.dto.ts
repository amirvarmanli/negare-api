import { ApiProperty } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: RoleName })
  @IsEnum(RoleName, {
    message: 'Invalid role. Must be a valid RoleName enum value.',
  })
  role!: RoleName;
}
