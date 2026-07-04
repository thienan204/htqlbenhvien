const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.menu.updateMany({
    where: { path: '/staff' },
    data: { title: 'Nhân sự & CCHN' }
  });
  console.log('Updated');
}
main();
