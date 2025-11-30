import { ApiProperty } from '@nestjs/swagger';

export class ArtistFollowResponseDto {
  @ApiProperty({
    description: 'Whether the current user now follows this artist',
    example: true,
  })
  followed!: boolean;

  @ApiProperty({
    description: 'Total number of followers after this change',
    example: 42,
  })
  followersCount!: number;
}
