import { PartialType } from '@nestjs/swagger';
import { CreateNewsletterCategoryDto } from '@app/newsletter/dto/create-newsletter-category.dto';

export class UpdateNewsletterCategoryDto extends PartialType(
  CreateNewsletterCategoryDto,
) {}
