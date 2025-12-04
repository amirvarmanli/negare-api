import { PartialType } from '@nestjs/swagger';
import { CreateBlogCategoryDto } from '@app/blog/dto/create-blog-category.dto';

export class UpdateBlogCategoryDto extends PartialType(CreateBlogCategoryDto) {}
