import { ApiProperty } from '@nestjs/swagger';
import { AdminUserDto } from '@app/core/users/admin/dto/admin-user.dto';

export class AdminUsersMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class AdminUsersResponseDto {
  @ApiProperty({ type: () => [AdminUserDto] })
  items!: AdminUserDto[];

  @ApiProperty({ type: () => AdminUsersMetaDto })
  meta!: AdminUsersMetaDto;
}
