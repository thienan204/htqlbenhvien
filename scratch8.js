const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
    console.log('Appying PL3 business rules...');
    
    // Rule: PL3 includes all PL2
    const addResult = await prisma.icd10Catalog.updateMany({
        where: { is_phu_luc_2_tt25: true },
        data: { is_phu_luc_3_tt25: true }
    });
    console.log('Added ' + addResult.count + ' codes from PL2 to PL3.');

    // Rule: PL3 does NOT include PL1
    const removeResult = await prisma.icd10Catalog.updateMany({
        where: { is_phu_luc_1_tt25: true },
        data: { is_phu_luc_3_tt25: false }
    });
    console.log('Removed ' + removeResult.count + ' codes from PL3 because they belong to PL1.');

    const finalCount = await prisma.icd10Catalog.count({
        where: { is_phu_luc_3_tt25: true }
    });
    console.log('Total is_phu_luc_3_tt25 = true:', finalCount);
    
    // Re-export the SQL file
    const data = await prisma.icd10Catalog.findMany({
        where: { is_phu_luc_3_tt25: true },
        select: { ma_chi_tiet: true }
    });
    const codesSql = data.map(d => d.ma_chi_tiet).filter(Boolean);
    const sql = `UPDATE "Icd10Catalog" SET "is_phu_luc_3_tt25" = false;
UPDATE "Icd10Catalog" SET "is_phu_luc_3_tt25" = true WHERE "ma_chi_tiet" IN ('${codesSql.join("', '")}');
UPDATE "Icd10Catalog" SET "is_phu_luc_3_tt25" = true WHERE "is_phu_luc_2_tt25" = true;
UPDATE "Icd10Catalog" SET "is_phu_luc_3_tt25" = false WHERE "is_phu_luc_1_tt25" = true;`;
    
    fs.writeFileSync('update_phuluc3.sql', sql);
    console.log('Exported update_phuluc3.sql successfully with business rules applied.');
}

main().finally(() => prisma.$disconnect());
