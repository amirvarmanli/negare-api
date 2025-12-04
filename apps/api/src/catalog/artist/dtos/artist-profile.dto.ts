import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductBriefDto } from '@app/catalog/product/dtos/product-response.dto';

// ----------------------------
// DTO نمای مهارت هنرمند
// ----------------------------
export class ArtistSkillDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  key!: string;

  @ApiProperty()
  nameFa!: string;

  @ApiPropertyOptional({ nullable: true })
  nameEn!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  sortOrder!: number;
}

// ----------------------------
// پروفایل هنرمند
// ----------------------------
export class ArtistProfileDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    description: 'نام نمایشی (اولویت: name → username)',
  })
  displayName!: string;

  @ApiPropertyOptional({
    description: 'نام کاربری هنرمند (ممکن است null باشد)',
    nullable: true,
  })
  username!: string | null;

  @ApiPropertyOptional({
    description: 'تصویر پروفایل هنرمند',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiPropertyOptional({
    description: 'بیوگرافی هنرمند',
    nullable: true,
  })
  bio!: string | null;

  @ApiProperty({
    type: [ArtistSkillDto],
    description: 'مهارت‌های هنرمند (حداکثر ۳ مورد برای supplier)',
  })
  skills!: ArtistSkillDto[];

  @ApiProperty({
    description: 'تعداد محصولاتی که این هنرمند تأمین‌کننده آن‌هاست',
  })
  productsCount!: number;

  @ApiProperty({
    description: 'تعداد دنبال‌کننده‌های هنرمند',
  })
  followersCount!: number;

  @ApiProperty({
    description: 'آیا کاربر فعلی این هنرمند را دنبال کرده است یا خیر',
  })
  isFollowedByCurrentUser!: boolean;

  @ApiPropertyOptional({
    type: [ProductBriefDto],
    description: 'لیست محصولات برتر هنرمند',
  })
  topProducts?: ProductBriefDto[];
}

export class ArtistPublicProfileDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({
    description: 'نام نمایشی (اولویت: name → username)',
  })
  displayName!: string;

  @ApiPropertyOptional({
    description: 'نام کاربری هنرمند (ممکن است null باشد)',
    nullable: true,
  })
  username!: string | null;

  @ApiPropertyOptional({
    description: 'تصویر پروفایل هنرمند',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiPropertyOptional({
    description: 'بیوگرافی هنرمند',
    nullable: true,
  })
  bio!: string | null;

  @ApiProperty({
    type: [ArtistSkillDto],
    description: 'مهارت‌های هنرمند',
  })
  skills!: ArtistSkillDto[];

  @ApiProperty({
    description: 'تعداد محصولاتی که این هنرمند تأمین‌کننده آن‌هاست',
  })
  productsCount!: number;

  @ApiProperty({
    description: 'تعداد دنبال‌کننده‌های هنرمند',
  })
  followersCount!: number;
}
