import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';

export class AdminUserCityDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

export class AdminUserSkillDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

export class AdminUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional()
  username?: string | null;

  @ApiPropertyOptional()
  firstName?: string | null;

  @ApiPropertyOptional()
  lastName?: string | null;

  @ApiPropertyOptional()
  phone?: string | null;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional()
  avatarUrl?: string | null;

  @ApiPropertyOptional()
  bio?: string | null;

  @ApiProperty({ enum: RoleName })
  role!: RoleName;

  @ApiPropertyOptional({ type: () => AdminUserCityDto, nullable: true })
  city?: AdminUserCityDto | null;

  @ApiProperty({ example: 0 })
  productsCount!: number;

  @ApiPropertyOptional({ type: () => [AdminUserSkillDto] })
  skills?: AdminUserSkillDto[];

  @ApiProperty()
  createdAt!: string;
}
