import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TopicDto {
  @ApiProperty() id!: string; // BigInt → string
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiPropertyOptional() coverUrl?: string | null;
  @ApiPropertyOptional() seoTitle?: string | null;
  @ApiPropertyOptional() seoDescription?: string | null;
  @ApiProperty({ example: 12 })
  usageCount!: number;
}

export class TopicListDto {
  @ApiProperty({ type: [TopicDto] })
  items!: TopicDto[];
}
