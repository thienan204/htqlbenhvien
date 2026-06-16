import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const menusWithTarget = await prisma.menu.findMany({
        where: {
            targetPath: { not: null },
            isActive: true
        },
        select: {
            path: true,
            targetPath: true
        }
    });
    console.log(menusWithTarget);
  } catch (error) {
    console.error("Prisma error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
