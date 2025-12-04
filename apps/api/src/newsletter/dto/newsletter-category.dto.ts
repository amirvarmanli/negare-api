import { ApiProperty } from '@nestjs/swagger';

export class NewsletterCategoryDto {
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
  issueCount!: number;
}

export class NewsletterCategoryListResponseDto {
  @ApiProperty({ type: () => [NewsletterCategoryDto] })
  items!: NewsletterCategoryDto[];
}
