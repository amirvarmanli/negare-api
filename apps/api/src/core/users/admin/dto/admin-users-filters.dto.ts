import { ApiProperty } from '@nestjs/swagger';

export class AdminUsersFilterCityDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ required: false })
  province?: string | null;
}

export class AdminUsersFilterSkillDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

export class AdminUsersFiltersResponseDto {
  @ApiProperty({ type: () => [AdminUsersFilterCityDto] })
  cities!: AdminUsersFilterCityDto[];

  @ApiProperty({ type: () => [AdminUsersFilterSkillDto] })
  skills!: AdminUsersFilterSkillDto[];
}
