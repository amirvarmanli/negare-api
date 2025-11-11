import { Prisma } from '@prisma/client';
import { TopicDto } from '@app/catalog/topics/dtos/topic-response.dto';

export type TopicWithCount = Prisma.TopicGetPayload<{
  include: { _count: { select: { productLinks: true } } };
}>;

export class TopicMapper {
  static toDto(topic: TopicWithCount): TopicDto {
    return {
      id: String(topic.id),
      name: topic.name,
      slug: topic.slug,
      coverUrl: topic.coverUrl ?? undefined,
      seoTitle: topic.seoTitle ?? undefined,
      seoDescription: topic.seoDescription ?? undefined,
      usageCount: topic._count.productLinks,
    };
  }
}
