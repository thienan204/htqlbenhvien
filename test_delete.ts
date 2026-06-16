import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const equip = await prisma.equipment.findFirst({
        where: { ten_vttb: 'fsadf' }
    });
    if (equip) {
        console.log("Found equipment:", equip.id);
        await prisma.equipment.delete({
            where: { id: equip.id }
        });
        console.log("Deleted successfully");
    } else {
        console.log("Not found");
    }
  } catch (error) {
    console.error("Prisma error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
