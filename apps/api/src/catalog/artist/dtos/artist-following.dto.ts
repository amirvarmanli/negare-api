// apps/api/src/catalog/artist/dtos/artist-following.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class FollowedArtistItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'نمایش نام: name یا username' })
  displayName!: string;

  @ApiProperty({ nullable: true })
  username!: string | null;

  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ nullable: true })
  bio!: string | null;

  @ApiProperty({
    description: 'تاریخی که کاربر این هنرمند را فالو کرده است',
  })
  followedAt!: Date;
}

export class FollowedArtistsListDto {
  @ApiProperty({ type: [FollowedArtistItemDto] })
  items!: FollowedArtistItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
