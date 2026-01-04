import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationType } from '@prisma/client';

export enum AdminNotificationsSortBy {
  createdAt = 'createdAt',
}

export enum SortDirection {
  asc = 'asc',
  desc = 'desc',
}

export class AdminNotificationsAllQueryDto {
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

  @ApiPropertyOptional({ description: 'Search title/body' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({ description: 'Filter by creator user id' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  createdById?: string;

  @ApiPropertyOptional({ enum: AdminNotificationsSortBy, default: AdminNotificationsSortBy.createdAt })
  @IsOptional()
  @IsEnum(AdminNotificationsSortBy)
  sortBy?: AdminNotificationsSortBy;

  @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.desc })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDir?: SortDirection;
}
