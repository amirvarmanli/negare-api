import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({ example: 1, minimum: 0 })
  @IsInt()
  @Min(0)
  qty!: number;
}
