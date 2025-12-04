import { ApiProperty } from '@nestjs/swagger';

export class NewsletterAuthorDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ required: false, nullable: true })
  name!: string | null;

  @ApiProperty({ required: false, nullable: true })
  avatarUrl!: string | null;
}
