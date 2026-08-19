import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const errors = await prisma.xmlErrorRecord.findMany({
        where: { sourceType: 'XML', chi_tiet_loi: { contains: '[CHUYEN_DE]' } },
        take: 5
    });
    console.log(JSON.stringify(errors.map(e => ({chi_tiet_loi: e.chi_tiet_loi, sourceType: e.sourceType})), null, 2));
}

main().finally(() => prisma.$disconnect());
