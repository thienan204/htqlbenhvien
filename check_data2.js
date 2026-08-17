const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const data = await prisma.mau05Catalog.findMany({
        where: { TEN_DICH_VU: { contains: 'liệt nửa người do tai biến' } }
    });
    console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
