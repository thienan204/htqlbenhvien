const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const staffs = await prisma.staff.findMany({ where: { ma_khoa: 'K16' } });
  console.log('Staff count in K16:', staffs.length);
  console.log(staffs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
