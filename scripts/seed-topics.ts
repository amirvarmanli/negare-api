// scripts/seed-topics.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type TopicSeed = {
  name: string;
  slug: string;
  coverUrl: string;
};

const topics: TopicSeed[] = [
  {
    name: 'اربعین حسینی',
    slug: 'اربعین-حسینی',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2025/7/29/1753781615_44990_%D8%A7%D8%B1%D8%A8%D8%B9%DB%8C%D9%86.jpg',
  },
  {
    name: 'اطلاعیه هیئت',
    slug: 'اطلاعیه-هیئت',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2024/11/21/1732175247_75800_%D8%A7%D8%B7%D9%84%D8%A7%D8%B9%DB%8C%D9%87%20%D9%87%DB%8C%D8%A6%D8%AA.jpg',
  },
  {
    name: 'امام زمان عجل الله',
    slug: 'امام-زمان-عجل-الله',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2025/9/14/1757858255_14244_%DB%8C%D8%A7%20%D8%B5%D8%A7%D8%AD%D8%A8%20%D8%A7%D9%84%D8%B2%D9%85%D8%A7%D9%86%20.jpg',
  },
  {
    name: 'تاسوعا',
    slug: 'تاسوعا',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2025/7/1/1751354295_13637_%D8%AA%D8%A7%D8%B3%D9%88%D8%B9%D8%A7.jpg',
  },
  {
    name: 'دستاوردها و پیشرفت ها',
    slug: 'دستاوردها-و-پیشرفت-ها',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2025/3/17/1742203140_18512_%D8%AF%D8%B3%D8%AA%D8%A7%D9%88%D8%B1%D8%AF%D9%87%D8%A7.jpg',
  },
  {
    name: 'دیوارنگاره ها',
    slug: 'دیوارنگاره-ها',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2025/8/3/1754220731_90215_%D8%AF%DB%8C%D9%88%D8%A7%D8%B1%D9%86%DA%AF%D8%A7%D8%B1%D9%87.jpg',
  },
  {
    name: 'شب قدر',
    slug: 'شب-قدر',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2025/3/17/1742202226_68729_%D8%B4%D8%A8%20%D9%82%D8%AF%D8%B1.jpg',
  },
  {
    name: 'شهادت امام رضا علیه السلام',
    slug: 'شهادت-امام-رضا-علیه-السلام',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2025/8/23/1755945545_63894_%D8%B4%D9%87%D8%A7%D8%AF%D8%AA%20%D8%A7%D9%85%D8%A7%D9%85%20%D8%B1%D8%B6%D8%A7.jpg',
  },
  {
    name: 'شهادت امام علی علیه السلام',
    slug: 'شهادت-امام-علیه-السلام',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2025/3/17/1742202528_96180_%D8%B4%D9%87%D8%A7%D8%AF%D8%AA%20%D8%A7%D9%85%D8%A7%D9%85%20%D8%B9%D9%84%DB%8C.jpg',
  },
  {
    name: 'شهادت حضرت رقیه سلام الله علیها',
    slug: 'شهادت-حضرت-رقیه-سلام-الله-علیها',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2025/7/30/1753861952_85702_%D8%AD%D8%B6%D8%B1%D8%AA%20%D8%B1%D9%82%DB%8C%D9%87.jpg',
  },
  {
    name: 'شهدای قربانی ترور',
    slug: 'شهدای-قربانی-ترور',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2025/8/24/1756035681_43802_%D8%B4%D9%87%D8%AF%D8%A7%DB%8C%20%D9%82%D8%B1%D8%A8%D8%A7%D9%86%DB%8C%20%D8%AA%D8%B1%D9%88%D8%B1.jpg',
  },
  {
    name: 'شهدای مقاومت ملی',
    slug: 'شهدای-مقاومت-ملی',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2025/7/15/1752580296_90116_%D8%B4%D9%87%D8%AF%D8%A7%DB%8C%20%D9%85%D9%82%D8%A7%D9%88%D9%85%D8%AA%20%D9%85%D9%84%DB%8C.jpg',
  },
  {
    name: 'شهید اسماعیل هنیه',
    slug: 'شهید-اسماعیل-هنیه',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2025/2/1/1738413561_19091_%D9%87%D9%86%DB%8C%D9%87.jpg',
  },
  {
    name: 'شهید امیرعلی حاجی زاده',
    slug: 'شهید-امیرعلی-حاجی-زاده',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2025/8/17/1755430649_61021_1755429820_87108_Farshchian.jpg',
  },
  {
    name: 'شهید حاج رمضان',
    slug: 'شهید-حاج-رمضان',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2025/8/17/1755429645_35809_haj%20ramezan.jpg',
  },
  {
    name: 'شهید سید محمد حسینی بهشتی',
    slug: 'شهید-سید-محمد-حسینی-بهشتی',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2025/1/30/1738236463_69654_%D8%B4%D9%87%DB%8C%D8%AF%20%D8%A8%D9%87%D8%B4%D8%AA%DB%8C.jpg',
  },
  {
    name: 'شهید محمد ضیف',
    slug: 'شهید-محمد-ضیف',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2025/3/17/1742202803_91195_%D8%B4%D9%87%DB%8C%D8%AF%20%D9%85%D8%AD%D9%85%D8%AF%20%D8%B6%DB%8C%D9%81.jpg',
  },
  {
    name: 'عاشورا',
    slug: 'عاشورا',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2025/7/1/1751354307_19208_%D8%B9%D8%A7%D8%B4%D9%88%D8%B1%D8%A7.jpg',
  },
  {
    name: 'فاطمیه',
    slug: 'فاطمیه',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2024/11/14/1731562912_32879_%D9%81%D8%A7%D8%B7%D9%85%DB%8C%D9%87.jpg',
  },
  {
    name: 'مدافعان حرم',
    slug: 'مدافعان-حرم',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2024/11/21/1732182797_29396_%D9%85%D8%AF%D8%A7%D9%81%D8%B9%D8%A7%D9%86%20%D8%AD%D8%B1%D9%85.jpg',
  },
  {
    name: 'مرحوم استاد محمود فرشچیان',
    slug: 'مرحوم-استاد-محمود-فرشچیان',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2025/8/17/1755429820_87108_Farshchian.jpg',
  },
  {
    name: 'موکاپ',
    slug: 'موکاپ',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2024/11/21/1732192989_85632_%D9%85%D9%88%DA%A9%D8%A7%D9%BE.jpg',
  },
  {
    name: 'میلاد حضرت زهرا سلام الله علیها',
    slug: 'میلاد-حضرت-زهرا-سلام-الله-علیها',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2024/12/19/1734596366_99196_%D9%85%DB%8C%D9%84%D8%A7%D8%AF%20%D8%AD%D8%B6%D8%B1%D8%AA%20%D8%B2%D9%87%D8%B1%D8%A7.jpg',
  },
  {
    name: 'هفته وحدت',
    slug: 'هفته-وحدت',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2025/9/4/1756989478_96873_%D9%87%D9%81%D8%AA%D9%87%20%D9%88%D8%AD%D8%AF%D8%AA.jpg',
  },
  {
    name: 'وعده صادق',
    slug: 'وعده-صادق',
    coverUrl:
      'https://dl1.negarestock.ir/S/p/2025/6/16/1750111744_13250_%D9%88%D8%B9%D8%AF%D9%87%20%D8%B5%D8%A7%D8%AF%D9%82.jpg',
  },
];

async function main() {
  await prisma.topic.createMany({
    data: topics.map((t) => ({
      name: t.name,
      slug: t.slug,
      coverUrl: t.coverUrl,
    })),
    skipDuplicates: true,
  });

  console.log(`✅ Inserted/ensured ${topics.length} topics.`);
}

main()
  .catch((error) => {
    console.error('❌ Error seeding topics:', error);
    process.exit(1);
  })
  .finally(async () => {
    prisma.$disconnect().catch(() => {
      // ignore
    });
  });
