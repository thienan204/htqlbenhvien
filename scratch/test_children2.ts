import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const child = await prisma.icd10Catalog.findUnique({
        where: { ma_chi_tiet: 'A00.9' }
    });
    console.log("A00.9 ma_benh: '" + child?.ma_benh + "'");
}
run().finally(() => prisma.$disconnect());
