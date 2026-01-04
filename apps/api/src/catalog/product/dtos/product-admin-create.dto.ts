import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { CreateProductDto } from '@app/catalog/product/dtos/product-create.dto';
import { toTrimmedString } from '@app/catalog/product/dtos/transformers';

export class AdminProductCreateDto extends CreateProductDto {
  @ApiPropertyOptional({
    description: 'Owner user id (UUID). When set, authorIds must be omitted.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(toTrimmedString)
  ownerId?: string;
}
