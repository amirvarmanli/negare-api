import { PrismaClient } from '@prisma/client';
import { PERMISSIONS_CATALOG } from '@app/common/authz/permissions.catalog';

const prisma = new PrismaClient();

async function run(): Promise<void> {
  await prisma.$transaction(
    PERMISSIONS_CATALOG.map((permission) =>
      prisma.permission.upsert({
        where: { key: permission.key },
        update: {
          title: permission.title,
          group: permission.group,
        },
        create: {
          key: permission.key,
          title: permission.title,
          group: permission.group,
        },
      }),
    ),
  );

  // eslint-disable-next-line no-console
  console.log(
    `✅ Seeded/updated ${PERMISSIONS_CATALOG.length} permissions.`,
  );
}

run()
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error('❌ Error seeding permissions:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
