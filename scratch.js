const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const cats = await prisma.systemCategory.findMany({
        where: { type: 'CHUC_DANH' },
        select: { code: true, name: true }
    });
    console.log(cats);
}

main().finally(() => prisma.$disconnect());
