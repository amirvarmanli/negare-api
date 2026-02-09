import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type CategorySeed = {
  name: string;
  slug: string;
};

const categories: CategorySeed[] = [
  { name: 'Blog', slug: 'blog' },
  { name: 'Newsletter', slug: 'newsletter' },
];

async function seedBlogNewsletterCategories(): Promise<void> {
  for (const category of categories) {
    const existing = await prisma.category.findFirst({
      where: {
        OR: [{ name: category.name }, { slug: category.slug }],
      },
      select: { id: true, name: true, slug: true },
    });

    if (existing) {
      console.log(
        `ℹ️  Category already exists: name="${existing.name}", slug="${existing.slug}", id=${existing.id.toString()}`,
      );
      continue;
    }

    const created = await prisma.category.create({
      data: {
        name: category.name,
        slug: category.slug,
      },
      select: { id: true, name: true, slug: true },
    });

    console.log(
      `✅ Created category: name="${created.name}", slug="${created.slug}", id=${created.id.toString()}`,
    );
  }
}

if (require.main === module) {
  seedBlogNewsletterCategories()
    .catch((error) => {
      console.error('❌ Error seeding Blog/Newsletter categories:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect().catch(() => {
        // ignore disconnect errors
      });
    });
}

export { seedBlogNewsletterCategories };
