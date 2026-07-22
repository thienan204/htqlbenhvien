const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
    const data = await prisma.icd10Catalog.findMany({
        where: { is_phu_luc_1_tt25: true },
        select: { ma_chi_tiet: true }
    });
    
    const codes = data.map(d => d.ma_chi_tiet).filter(Boolean);
    
    const sql = `UPDATE "Icd10Catalog" SET "is_phu_luc_1_tt25" = false;
UPDATE "Icd10Catalog" SET "is_phu_luc_1_tt25" = true WHERE "ma_chi_tiet" IN ('${codes.join("', '")}');
UPDATE "Icd10Catalog" SET "is_phu_luc_2_tt25" = false WHERE "is_phu_luc_1_tt25" = true;`;
    
    fs.writeFileSync('update_phuluc1.sql', sql);
    console.log('Exported SQL successfully with ' + codes.length + ' codes.');
}

main().finally(() => prisma.$disconnect());
