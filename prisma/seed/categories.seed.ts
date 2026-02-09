import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type CategorySeed = {
  name: string;
  slug: string;
};

const categories: CategorySeed[] = [
  { name: 'گرافیک', slug: 'graphic' },
  { name: 'نقاشی و تصویرسازی', slug: 'illustration' },
  { name: 'کارتون و کاریکاتور', slug: 'cartoon-caricature' },
  { name: 'حروف نگاری', slug: 'typography' },
  { name: 'تکنولوژی', slug: 'technology' },
  { name: 'رویداد', slug: 'events' },
  { name: 'اخبار روز', slug: 'daily-news' },
  { name: 'خبرهای گرافیکی', slug: 'graphic-news' },
  { name: 'جنجالی', slug: 'controversial' },
  { name: 'ویژه نگاره', slug: 'negare-special' },
];

export async function seedBlogNewsletterCategories(): Promise<void> {
  await prisma.category.createMany({
    data: categories,
    skipDuplicates: true,
  });

  console.log(`✅ Seeded blog/newsletter categories: ${categories.length}`);
}

if (require.main === module) {
  seedBlogNewsletterCategories()
    .catch((error) => {
      console.error('❌ Error seeding blog/newsletter categories:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect().catch(() => {
        // ignore disconnect errors
      });
    });
}
