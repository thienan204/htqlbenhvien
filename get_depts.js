const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const depts = await prisma.department.findMany({ take: 10 });
  console.log(depts);
}

main().finally(() => prisma.$disconnect());
