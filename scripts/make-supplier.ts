import { PrismaClient, RoleName } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const username = 'hossein';

  console.log(`🔍 Searching user by username: ${username}`);

  const user = await prisma.user.findFirst({
    where: { username },
  });

  if (!user) {
    console.error('❌ User not found');
    process.exit(1);
  }

  console.log(`✅ User found: ${user.id} (${user.username})`);

  // پیدا کردن رول supplier یا ساختن آن
  let supplierRole = await prisma.role.findUnique({
    where: { name: RoleName.supplier },
  });

  if (!supplierRole) {
    console.log('ℹ️ supplier role not found. Creating it...');
    supplierRole = await prisma.role.create({
      data: { name: RoleName.supplier },
    });
    console.log(`✅ supplier role created with id: ${supplierRole.id}`);
  }

  // ایجاد رابطه در جدول میانی user_roles
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: supplierRole.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: supplierRole.id,
    },
  });

  console.log(`🎉 User "${username}" is now SUPPLIER`);
}

main()
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
