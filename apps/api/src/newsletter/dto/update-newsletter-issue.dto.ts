import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { CreateNewsletterIssueDto } from '@app/newsletter/dto/create-newsletter-issue.dto';

export class UpdateNewsletterIssueDto extends PartialType(
  CreateNewsletterIssueDto,
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  authorId?: string;
}
