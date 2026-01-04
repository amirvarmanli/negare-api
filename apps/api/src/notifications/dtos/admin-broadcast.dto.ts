import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { NotificationTargetGroup, NotificationType } from '@prisma/client';
import { PaginationMetaDto } from '@app/common/dto/pagination.dto';
import { toTrimmedString } from '@app/catalog/product/dtos/transformers';

export class AdminBroadcastRequestDto {
  @ApiProperty({ example: 'اطلاعیه' })
  @IsString()
  @MaxLength(200)
  @Transform(toTrimmedString)
  title!: string;

  @ApiProperty({ example: 'این یک پیام عمومی است.' })
  @IsString()
  @MaxLength(2000)
  @Transform(toTrimmedString)
  body!: string;

  @ApiPropertyOptional({ description: 'Optional action URL (relative or absolute)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(toTrimmedString)
  actionUrl?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiProperty({ enum: NotificationTargetGroup })
  @IsEnum(NotificationTargetGroup)
  targetGroup!: NotificationTargetGroup;
}

export class AdminBroadcastResponseDto {
  @ApiProperty({ example: 'notification-uuid' })
  notificationId!: string;

  @ApiProperty({ example: true })
  queued!: boolean;
}

export class AdminBroadcastSenderDto {
  @ApiProperty({ example: 'admin-uuid' })
  id!: string;

  @ApiProperty({ example: 'Negare Admin' })
  fullName!: string;

  @ApiPropertyOptional({ example: 'https://cdn.negare.test/avatar.png' })
  avatarUrl?: string | null;

  @ApiPropertyOptional({ example: 'admin@negare.test' })
  email?: string | null;

  @ApiPropertyOptional({ example: '+989121234567' })
  phone?: string | null;
}

export class AdminBroadcastItemDto {
  @ApiProperty({ example: 'notification-uuid' })
  id!: string;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiProperty({ example: 'Broadcast message body' })
  message!: string;

  @ApiProperty({ example: '2025-01-01T10:00:00.000Z' })
  sentAt!: string;

  @ApiProperty({ type: AdminBroadcastSenderDto })
  sender!: AdminBroadcastSenderDto;
}

export class AdminBroadcastListDto {
  @ApiProperty({ type: [AdminBroadcastItemDto] })
  items!: AdminBroadcastItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class AdminBroadcastDeleteResponseDto {
  @ApiProperty({ example: true })
  success!: true;
}
