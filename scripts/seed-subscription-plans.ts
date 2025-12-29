import { PrismaClient } from '@prisma/client';
import { SUBSCRIPTION_PLANS } from '@app/finance/common/finance.constants';

const prisma = new PrismaClient();

async function run(): Promise<void> {
  for (const plan of Object.values(SUBSCRIPTION_PLANS)) {
    await prisma.financeSubscriptionPlan.upsert({
      where: { code: plan.code },
      update: {
        dailySubLimit: plan.dailySubLimit,
        dailyFreeLimit: plan.dailyFreeLimit,
        isActive: true,
      },
      create: {
        code: plan.code,
        dailySubLimit: plan.dailySubLimit,
        dailyFreeLimit: plan.dailyFreeLimit,
        isActive: true,
      },
    });
  }
}

run()
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
