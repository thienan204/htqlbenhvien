import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const parents = ['A00'];
    const children = await prisma.icd10Catalog.findMany({
        where: {
            ma_benh: { in: parents },
            ma_chi_tiet: { notIn: parents },
            requires_more_specific: false
        },
        select: { ma_chi_tiet: true, ma_benh: true },
        orderBy: { ma_chi_tiet: 'asc' }
    });
    console.log("Children of A00:", children);
}
run().finally(() => prisma.$disconnect());
