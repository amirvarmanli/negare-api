// prisma/seed.ts
import {
  PrismaClient,
  PricingType,
  ProductStatus,
  GraphicFormat,
} from '@prisma/client';
import productsRaw from '../seed-data/products.json';

const prisma = new PrismaClient();

type ApiProduct = {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  graphicFormats: string[];
  colors: string[];
  pricingType: string;
  price: number;
  creatorId: string;
  status: string;
  viewsCount: number;
  downloadsCount: number;
  likesCount: number;
  shortLink?: string;
  seoKeywords: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  fileSizeMB: number;
  fileBytes: string;
  createdAt: string;
  updatedAt: string;
};

function toIntStringId(id: string): number {
  // اگر تو DB id عددی هست
  const n = Number(id);
  if (!Number.isFinite(n)) throw new Error(`Invalid numeric id: ${id}`);
  return n;
}

async function main() {
  const items = (productsRaw as any).data.items as ApiProduct[];

  // ✅ اینجا فرض گرفتیم مدل Product تو DB این فیلدها رو داره
  // اگر اسم فیلدها فرق داره، فقط mapping رو عوض می‌کنیم
  const productsToInsert = items.map((p) => ({
    id: toIntStringId(p.id),
    slug: p.slug,
    title: p.title,
    coverUrl: p.coverUrl ?? null,
    graphicFormats: p.graphicFormats as GraphicFormat[],
    colors: p.colors ?? [],
    pricingType: p.pricingType as PricingType,
    price: p.price ?? 0,
    creatorId: p.creatorId,
    status: p.status as ProductStatus,
    viewsCount: p.viewsCount ?? 0,
    downloadsCount: p.downloadsCount ?? 0,
    likesCount: p.likesCount ?? 0,
    seoKeywords: p.seoKeywords ?? [],
    seoTitle: p.seoTitle ?? null,
    seoDescription: p.seoDescription ?? null,
    fileSizeMB: p.fileSizeMB ?? 0,
    fileBytes: BigInt(p.fileBytes ?? '0'), // اگر تو DB bigint هست
    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.updatedAt),
  }));

  await prisma.product.createMany({
    data: productsToInsert,
    skipDuplicates: true,
  });

  console.log(`Seeded products: ${productsToInsert.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
