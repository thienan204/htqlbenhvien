const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const data = await prisma.mau05Catalog.findMany({
        where: { TEN_DICH_VU: { contains: 'thắt lưng- hông' } }
    });
    console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
