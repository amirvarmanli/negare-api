import { PrismaClient, RoleName } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const username = 'varmanli';

  console.log(`🔍 Searching user by username: ${username}`);

  const user = await prisma.user.findFirst({
    where: { username },
  });

  if (!user) {
    console.error('❌ User not found');
    process.exit(1);
  }

  console.log(`✅ User found: ${user.id} (${user.username})`);

  // پیدا کردن رول admin یا ساختنش
  let adminRole = await prisma.role.findUnique({
    where: { name: RoleName.admin },
  });

  if (!adminRole) {
    console.log('ℹ️ admin role not found. Creating it...');
    adminRole = await prisma.role.create({
      data: { name: RoleName.admin },
    });
    console.log(`✅ admin role created with id: ${adminRole.id}`);
  }

  // ایجاد رابطه در جدول میانی
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: adminRole.id,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { role: RoleName.admin },
  });

  console.log(`🎉 User "${username}" is now ADMIN`);
}

main()
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
