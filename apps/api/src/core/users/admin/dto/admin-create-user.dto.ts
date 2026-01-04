import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { RoleName } from '@prisma/client';
import { Match } from '@app/common/validators/match.decorator';

export class AdminCreateUserDto {
  @ApiPropertyOptional({
    example: 'https://cdn.example.com/avatars/user.png',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatarUrl?: string | null;

  @ApiProperty({ example: 'john_doe' })
  @IsString()
  @Length(3, 32)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'username may contain letters, numbers, dot, underscore, or dash.',
  })
  username!: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @MaxLength(120)
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MaxLength(120)
  lastName!: string;

  @ApiProperty({ example: '+989121234567' })
  @IsString()
  @MaxLength(16)
  @Matches(/^\+?[0-9]{7,16}$/, {
    message: 'phone must be a valid international number.',
  })
  phone!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  cityId?: string | null;

  @ApiPropertyOptional({ example: 'Short bio' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string | null;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @Length(8, 128)
  password!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @Match('password', { message: 'passwordConfirm must match password.' })
  passwordConfirm!: string;

  @ApiPropertyOptional({ enum: RoleName, default: RoleName.user })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsEnum(RoleName)
  role?: RoleName;
}
