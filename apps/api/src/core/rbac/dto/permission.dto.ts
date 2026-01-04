import { ApiProperty } from '@nestjs/swagger';

export class PermissionDto {
  @ApiProperty({ example: 'admin.blog:manage' })
  key!: string;

  @ApiProperty({ example: 'Manage blog' })
  title!: string;

  @ApiProperty({ example: 'Blog' })
  group!: string;
}
