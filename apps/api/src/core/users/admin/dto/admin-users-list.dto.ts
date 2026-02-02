import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';

export class AdminUserListStatsDto {
  @ApiProperty({ example: 3 })
  purchasesCount!: number;

  @ApiProperty({ example: 12 })
  downloadsCount!: number;
}

export class AdminUserListRowDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl!: string | null;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  username!: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  city!: string | null;

  @ApiProperty({ enum: RoleName })
  role!: RoleName;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional({ type: () => AdminUserListStatsDto })
  stats?: AdminUserListStatsDto;
}

export class AdminUsersListMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class AdminUsersListResponseDto {
  @ApiProperty({ type: () => [AdminUserListRowDto] })
  items!: AdminUserListRowDto[];

  @ApiProperty({ type: () => AdminUsersListMetaDto })
  meta!: AdminUsersListMetaDto;
}
