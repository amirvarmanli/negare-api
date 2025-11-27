import { ApiProperty } from '@nestjs/swagger';

export class ArtistFollowResponseDto {
  @ApiProperty({ description: 'Follow state after the operation' })
  followed!: boolean;

  @ApiProperty({ description: 'Updated followers count' })
  followersCount!: number;
}
