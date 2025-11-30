// apps/api/src/catalog/artist/dtos/artist-list.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { toTrimmedString } from '@app/catalog/product/dtos/transformers';
import { ArtistSkillDto } from '@app/catalog/artist/dtos/artist-profile.dto';

/* -------------------------------------
   انواع مرتب‌سازی آرشیو هنرمندان
------------------------------------- */

export type ArtistSortMode = 'popular' | 'mostProducts' | 'latest';

export const ARTIST_SORTS: ArtistSortMode[] = [
  'popular',
  'mostProducts',
  'latest',
];

/* -------------------------------------
   Query DTO – پارامترهای ورودی لیست هنرمندان
------------------------------------- */

export class ArtistListQueryDto {
  @ApiPropertyOptional({
    description: 'متن جستجو روی نام، نام‌کاربری یا بیو',
    example: 'گرافیک',
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  @Transform(toTrimmedString)
  q?: string;

  @ApiPropertyOptional({
    description: 'کلید مهارت برای فیلتر هنرمندان',
    example: 'illustration',
  })
  @IsOptional()
  @IsString()
  @Transform(toTrimmedString)
  skillKey?: string;

  @ApiPropertyOptional({
    enum: ARTIST_SORTS,
    example: 'popular',
    description: 'مرتب‌سازی هنرمندان',
  })
  @IsOptional()
  @IsString()
  @IsIn(ARTIST_SORTS)
  sort?: ArtistSortMode;

  @ApiPropertyOptional({ minimum: 1, maximum: 60, example: 24 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  limit?: number;

  @ApiPropertyOptional({ minimum: 1, example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;
}

/* -------------------------------------
   Item DTO – یک هنرمند در آرشیو
------------------------------------- */

export class ArtistListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    description: 'نمایش‌نام نرمال‌شده (name یا username)',
  })
  displayName!: string;

  @ApiPropertyOptional({ nullable: true })
  username!: string | null;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  bio!: string | null;

  @ApiProperty({ type: [ArtistSkillDto] })
  skills!: ArtistSkillDto[];

  @ApiProperty({ description: 'تعداد دنبال‌کننده‌ها' })
  followersCount!: number;

  @ApiProperty({ description: 'تعداد آثار (محصولات)' })
  productsCount!: number;
}

/* -------------------------------------
   Result DTO – خروجی کامل آرشیو هنرمندان
------------------------------------- */

export class ArtistListResultDto {
  @ApiProperty({ type: [ArtistListItemDto] })
  items!: ArtistListItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  hasNextPage!: boolean;

  @ApiProperty()
  hasPrevPage!: boolean;
}
