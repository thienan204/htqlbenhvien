const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const statuses = await prisma.hoSoDaGui.groupBy({
    by: ['trangThaiTT'],
    _count: {
      trangThaiTT: true,
    },
  });
  console.log("trangThaiTT values in DB:", statuses);

  const hsStatuses = await prisma.hoSoDaGui.groupBy({
    by: ['trangThaiHS'],
    _count: {
      trangThaiHS: true,
    },
  });
  console.log("trangThaiHS values in DB:", hsStatuses);
}

main().catch(console.error).finally(() => prisma.$disconnect());
