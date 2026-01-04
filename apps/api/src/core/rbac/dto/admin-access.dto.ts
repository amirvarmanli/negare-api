import { ApiProperty } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';

export class AdminAccessDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: RoleName })
  role!: RoleName;

  @ApiProperty({ type: () => [String] })
  permissions!: string[];
}
