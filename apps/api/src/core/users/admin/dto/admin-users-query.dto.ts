import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RoleName } from '@prisma/client';
import { toTrimmedString } from '@app/catalog/product/dtos/transformers';

export enum AdminUsersSort {
  createdAtDesc = 'createdAtDesc',
  createdAtAsc = 'createdAtAsc',
}

export class AdminUsersQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Search by name/username/phone/email/city',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(toTrimmedString)
  q?: string;

  @ApiPropertyOptional({ enum: RoleName })
  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;

  @ApiPropertyOptional({ description: 'Filter by city name', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(toTrimmedString)
  city?: string;

  @ApiPropertyOptional({
    enum: AdminUsersSort,
    default: AdminUsersSort.createdAtDesc,
  })
  @IsOptional()
  @IsEnum(AdminUsersSort)
  sort?: AdminUsersSort;

  @ApiPropertyOptional({ description: 'Filter from createdAt (ISO date)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Filter to createdAt (ISO date)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
