const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const result = await prisma.icd10Catalog.updateMany({
        where: {
            is_phu_luc_1_tt25: true,
            is_phu_luc_2_tt25: true
        },
        data: {
            is_phu_luc_2_tt25: false
        }
    });
    console.log('Fixed ' + result.count + ' codes that were in both Phụ lục 1 and 2.');
}

main().finally(() => prisma.$disconnect());
