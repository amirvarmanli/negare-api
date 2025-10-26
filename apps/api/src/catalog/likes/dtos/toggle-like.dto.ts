import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class ToggleLikeDto {
  @ApiPropertyOptional({
    description:
      'Desired like state. When omitted the current state is toggled.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  liked?: boolean;
}
