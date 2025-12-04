import { ApiProperty } from '@nestjs/swagger';

export class BlogCategoryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ required: false, nullable: true })
  description!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ required: false, nullable: true })
  parentId!: string | null;

  @ApiProperty()
  postCount!: number;
}

export class BlogCategoryListResponseDto {
  @ApiProperty({ type: () => [BlogCategoryDto] })
  items!: BlogCategoryDto[];
}
