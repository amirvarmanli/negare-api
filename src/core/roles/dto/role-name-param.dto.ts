import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { RoleName } from '../role.entity';

export class RoleNameParamDto {
  @ApiProperty({ enum: RoleName })
  @IsEnum(RoleName)
  name: RoleName;
}
