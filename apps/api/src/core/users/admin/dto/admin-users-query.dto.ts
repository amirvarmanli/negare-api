import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum AdminUsersSortBy {
  createdAt = 'createdAt',
  lastName = 'lastName',
  firstName = 'firstName',
  productsCount = 'productsCount',
  cityName = 'cityName',
}

export enum SortDirection {
  asc = 'asc',
  desc = 'desc',
}

const toBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return undefined;
};

const toIdList = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    const merged = value
      .flatMap((entry) => String(entry).split(','))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return merged.length > 0 ? merged : undefined;
  }
  if (typeof value === 'string') {
    const parts = value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return parts.length > 0 ? parts : undefined;
  }
  return undefined;
};

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

  @ApiPropertyOptional({ description: 'Search by name/phone/email/username' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ description: 'Filter users who have at least one product' })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  hasProduct?: boolean;

  @ApiPropertyOptional({ description: 'Filter only artists/suppliers' })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  artistOnly?: boolean;

  @ApiPropertyOptional({ description: 'Filter by city id (UUID)' })
  @IsOptional()
  @IsUUID('4')
  cityId?: string;

  @ApiPropertyOptional({
    description: 'Filter by skill ids (comma-separated or repeated params)',
    type: () => [String],
  })
  @IsOptional()
  @Transform(({ value }) => toIdList(value))
  @IsArray()
  @IsUUID('4', { each: true })
  skillIds?: string[];

  @ApiPropertyOptional({ enum: AdminUsersSortBy, default: AdminUsersSortBy.createdAt })
  @IsOptional()
  @IsEnum(AdminUsersSortBy)
  sortBy?: AdminUsersSortBy;

  @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.desc })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDir?: SortDirection;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  includeSkills?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  includeCity?: boolean;
}
