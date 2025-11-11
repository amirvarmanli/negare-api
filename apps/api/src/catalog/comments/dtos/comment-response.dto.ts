import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommentTarget } from '@prisma/client';

export class CommentDto {
  @ApiProperty() id!: string; // BigInt → string
  @ApiProperty() userId!: string;
  @ApiProperty() body!: string;
  @ApiProperty() isApproved!: boolean;
  @ApiProperty({ enum: CommentTarget }) targetType!: CommentTarget;
  @ApiProperty() targetId!: string;
  @ApiPropertyOptional() productId?: string | null;
  @ApiPropertyOptional() parentId?: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class CommentListDto {
  @ApiProperty({ type: [CommentDto] }) items!: CommentDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() hasNext!: boolean;
}

export class ProductCommentsResultDto {
  @ApiProperty({ type: [CommentDto] }) items!: CommentDto[];
  @ApiPropertyOptional({ description: 'opaque cursor (base64)' })
  nextCursor?: string;
}
