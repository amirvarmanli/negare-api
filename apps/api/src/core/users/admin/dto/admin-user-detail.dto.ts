import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';

export class AdminUserSkillBriefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;
}

export class AdminUserDetailDto {
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

  @ApiPropertyOptional({ nullable: true })
  bio!: string | null;

  @ApiProperty({ enum: RoleName })
  role!: RoleName;

  @ApiProperty({ type: () => [AdminUserSkillBriefDto] })
  skills!: AdminUserSkillBriefDto[];

  @ApiProperty()
  createdAt!: string;
}

export class AdminUserFinancialDto {
  @ApiProperty({ example: 0 })
  walletBalance!: number;

  @ApiPropertyOptional({ example: 0, nullable: true })
  supplierEarningsTotal!: number | null;
}

export class AdminUserStatsDto {
  @ApiProperty({ example: 0 })
  purchasesCount!: number;

  @ApiProperty({ example: 0 })
  downloadsCount!: number;

  @ApiProperty({ example: 0 })
  transactionsCount!: number;

  @ApiProperty({ example: 0 })
  notificationsCount!: number;
}

export class AdminUserDetailResponseDto {
  @ApiProperty({ type: () => AdminUserDetailDto })
  user!: AdminUserDetailDto;

  @ApiProperty({ type: () => AdminUserFinancialDto })
  financial!: AdminUserFinancialDto;

  @ApiProperty({ type: () => AdminUserStatsDto })
  stats!: AdminUserStatsDto;
}
