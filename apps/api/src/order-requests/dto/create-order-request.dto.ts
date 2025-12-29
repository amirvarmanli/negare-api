import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Messenger } from '@prisma/client';

export class CreateOrderRequestDto {
  @ApiProperty({ example: 'Martyr Example' })
  @IsString()
  @MinLength(3)
  fullName!: string;

  @ApiProperty({ enum: Messenger, example: Messenger.telegram })
  @IsEnum(Messenger)
  messenger!: Messenger;

  @ApiProperty({ example: '09123456789' })
  @IsString()
  @Matches(/^09\d{9}$/)
  phoneNumber!: string;

  @ApiProperty({ required: false, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 3, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  imageCount!: number;

  @ApiProperty({ example: 'https://cdn.example.com/uploads/file.zip' })
  @IsString()
  @MaxLength(1000)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  fileUrl!: string;
}
