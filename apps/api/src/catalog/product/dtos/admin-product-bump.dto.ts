import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class AdminProductBumpRequestDto {}

export class AdminProductBumpResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  pinnedAt?: string | null;
}
