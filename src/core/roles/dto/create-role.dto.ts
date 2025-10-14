import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { RoleName } from '../role.entity';

export class CreateRoleDto {
  @ApiProperty({ enum: RoleName })
  @IsEnum(RoleName)
  name: RoleName;
}
