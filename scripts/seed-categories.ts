// scripts/seed-categories.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type CategorySeed = {
  name: string;
  slug: string;
  coverUrl: string;
  parentId: number | null; // 👈 طبق Prisma: number | bigint | null
};

const categories: CategorySeed[] = [
  {
    name: 'تصاویر خام',
    slug: 'تصاویر-خام',
    parentId: null,
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2024/6/26/1719423206_35656_1719236649_79909_Untitled-1.jpg',
  },
  {
    name: 'جعبه ابزار',
    slug: 'جعبه-ابزار',
    parentId: null,
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2024/6/26/1719424041_69559_17146529921AFA9EY306278.jpg',
  },
  {
    name: 'حروف نگاری',
    slug: 'حروف-نگاری',
    parentId: null,
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2024/6/26/1719423100_62685_1719236649_79909_Untitled-1.jpg',
  },
  {
    name: 'سه بعدی',
    slug: 'سه-بعدی',
    parentId: null,
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2024/6/26/1719423805_76630_1719236649_79909_Untitled-1.jpg',
  },
  {
    name: 'کارتون و کاریکاتور',
    slug: 'کارتون-و-کاریکاتور',
    parentId: null,
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2024/6/26/1719422911_98834_1719236649_79909_Untitled-1.jpg',
  },
  {
    name: 'گرافیک',
    slug: 'گرافیک',
    parentId: null,
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2024/6/26/1719422720_64142_1719236649_79909_Untitled-1.jpg',
  },
  {
    name: 'نقاشی و تصویرسازی',
    slug: 'نقاشی-و-تصویرسازی',
    parentId: null,
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2024/6/26/1719422801_71376_1719236649_79909_Untitled-1.jpg',
  },
  {
    name: 'هوش مصنوعی',
    slug: 'هوش-مصنوعی',
    parentId: null,
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2024/7/21/1721560466_28118_1719423100_62685_1719236649_79909_Untitled-1.jpg',
  },
];

async function main() {
  await prisma.category.createMany({
    data: categories.map((c) => ({
      name: c.name,
      slug: c.slug,
      coverUrl: c.coverUrl,
      parentId: c.parentId, // 👈 الان typeش درست شده
    })),
    skipDuplicates: true,
  });

  console.log(`✅ Inserted/ensured ${categories.length} categories.`);
}

main()
  .catch((err) => {
    console.error('❌ Error seeding categories:', err);
    process.exit(1);
  })
  .finally(async () => {
    prisma.$disconnect().catch(() => {
      // ignore
    });
  });
