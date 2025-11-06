/**
 * DTO representing supported profile mutations initiated by authenticated users.
 * Updated: fully nullable-safe, compatible with Prisma & class-validator.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/**
 * Allows mutating safe profile fields (name, bio, city, avatarUrl)
 * while deferring contact changes (email/phone) to OTP flows.
 */
export class UpdateProfileDto {
  // ───────────────────────────────
  // Display name
  // ───────────────────────────────
  @ApiPropertyOptional({
    example: 'Negare User',
    description:
      'Display name for the user. Use null or empty string to clear.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string | null;

  // ───────────────────────────────
  // Bio
  // ───────────────────────────────
  @ApiPropertyOptional({
    example: 'Capital markets enthusiast',
    description:
      'Short bio shown in the user profile. Use null or empty string to clear.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: string | null;

  // ───────────────────────────────
  // City
  // ───────────────────────────────
  @ApiPropertyOptional({
    example: 'Tehran',
    description: 'City where the user is active.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string | null;

  // ───────────────────────────────
  // Avatar URL
  // ───────────────────────────────
  @ApiPropertyOptional({
    example: 'https://cdn.negare.com/avatar.png',
    description:
      'Full URL of the avatar image. Must include protocol (https://). Null allowed to clear.',
  })
  @ValidateIf((o) => o.avatarUrl !== null && o.avatarUrl !== undefined)
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'Invalid avatar URL format.' })
  avatarUrl?: string | null;

  // ───────────────────────────────
  // Email (blocked for direct change)
  // ───────────────────────────────
  @ApiPropertyOptional({
    example: 'new-email@example.com',
    description:
      'Email changes are not permitted on this endpoint. Send via OTP flow instead.',
  })
  @IsOptional()
  @IsEmpty({
    message: 'Email changes are not permitted on this endpoint.',
  })
  email?: string | null;

  // ───────────────────────────────
  // Phone (blocked for direct change)
  // ───────────────────────────────
  @ApiPropertyOptional({
    example: '09123456789',
    description:
      'Phone number changes are not permitted on this endpoint. Use OTP verification flow.',
  })
  @IsOptional()
  @IsEmpty({
    message: 'Phone changes are not permitted on this endpoint.',
  })
  phone?: string | null;
}
