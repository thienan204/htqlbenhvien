const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const result = await prisma.icd10Catalog.updateMany({
        where: { is_phu_luc_1_tt25: true },
        data: { is_phu_luc_2_tt25: true }
    });
    console.log('Fixed local DB: Set is_phu_luc_2_tt25 = true for ' + result.count + ' codes belonging to Phụ lục 1.');
}

main().finally(() => prisma.$disconnect());
