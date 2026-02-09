import { ApiProperty } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';

export class BlogAdminAuthorDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ required: false, nullable: true })
  fullName!: string | null;

  @ApiProperty({ required: false, nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ required: false, nullable: true })
  email!: string | null;

  @ApiProperty({ enum: RoleName })
  role!: RoleName;
}
