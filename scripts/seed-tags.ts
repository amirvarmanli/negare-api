import { PrismaClient } from '@prisma/client';
import tagsRaw from '../seed-data/tags.json';

const prisma = new PrismaClient();

type ApiTag = {
  id: string;
  name: string;
  slug: string;
  usageCount?: number;
};

function toIntStringId(id: string): number {
  const n = Number(id);
  if (!Number.isFinite(n)) throw new Error(`Invalid numeric id: ${id}`);
  return n;
}

export async function seedTags() {
  const items = (tagsRaw as any).data.items as ApiTag[];

  const tagsToInsert = items.map((t) => ({
    id: toIntStringId(t.id), // اگر تو DB id عددیه
    name: t.name,
    slug: t.slug,
  }));

  await prisma.tag.createMany({
    data: tagsToInsert,
    skipDuplicates: true,
  });

  console.log(`✅ Seeded tags: ${tagsToInsert.length}`);
}
