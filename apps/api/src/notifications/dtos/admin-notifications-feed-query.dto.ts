import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationType } from '@prisma/client';

export enum AdminNotificationsFeedReadFilter {
  all = 'all',
  read = 'read',
  unread = 'unread',
}

export class AdminNotificationsFeedQueryDto {
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

  @ApiPropertyOptional({ description: 'Search notification body/title and recipient identity.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ description: 'Include deleted deliveries.', default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeDeleted?: boolean;

  @ApiPropertyOptional({ enum: AdminNotificationsFeedReadFilter, default: AdminNotificationsFeedReadFilter.all })
  @IsOptional()
  @IsEnum(AdminNotificationsFeedReadFilter)
  read?: AdminNotificationsFeedReadFilter;

  @ApiPropertyOptional({ enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({ description: 'Filter by recipient user id.' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  recipientId?: string;
}
