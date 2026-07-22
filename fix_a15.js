const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Add Phuluc 2 to A15.*
    const result = await prisma.icd10Catalog.updateMany({
        where: { ma_chi_tiet: { startsWith: 'A15.' } },
        data: { is_phu_luc_2_tt25: true }
    });

    console.log('Fixed local DB: Re-added Phụ lục 2 to A15.* (' + result.count + ' codes updated).');
}

main().finally(() => prisma.$disconnect());
