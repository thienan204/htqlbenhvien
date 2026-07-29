const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const menus = await prisma.menu.findMany({ where: { path: '/admin/dashboard-cards' } });
    console.log("menus:", menus);
    const aliases = await prisma.menu.findMany({ where: { targetPath: { not: null } } });
    console.log("aliases:", aliases);
}
main().catch(console.error).finally(() => prisma.$disconnect());
