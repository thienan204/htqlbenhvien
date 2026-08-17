const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const data = await prisma.mau05Catalog.findMany({
        where: { MA_DICH_VU: { in: ['08.0392.0280', '08.0391.0280'] } }
    });
    console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
