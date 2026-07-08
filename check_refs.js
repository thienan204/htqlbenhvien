const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const staff = await prisma.staff.findMany({
    include: {
        chuc_danh_ref: true,
        vi_tri_ref: true,
        certificates: true
    },
    take: 5
  });

  console.log(JSON.stringify(staff, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
