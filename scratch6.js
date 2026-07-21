const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const fs = require('fs');

const prisma = new PrismaClient();

function expandRange(start, end) {
    const prefix = start.replace(/[0-9.]+/, '');
    const startNumStr = start.replace(/^[A-Z]+/, '');
    const endNumStr = end.replace(/^[A-Z]+/, '');
    const startNum = parseFloat(startNumStr);
    const endNum = parseFloat(endNumStr);
    
    const codes = [];
    if (start.includes('.') || end.includes('.')) {
        const baseStart = Math.floor(startNum);
        const startDec = Math.round((startNum - baseStart)*10);
        const endDec = Math.round((endNum - Math.floor(endNum))*10);
        for(let i=startDec; i<=endDec; i++) {
            codes.push(prefix + baseStart + '.' + i);
        }
    } else {
        for (let i = startNum; i <= endNum; i++) {
            codes.push(prefix + i.toString().padStart(2, '0'));
        }
    }
    return codes;
}

function parseAdvanced(str) {
    if (!str) return {codes: [], exclude: []};
    let raw = str.replace(/[\*\+†]/g, '').replace(/\n/g, ' ').trim();
    let codes = [];
    let exclude = [];
    
    const exRegex = /\(trừ mã ([^\)]+)\)/ig;
    let match;
    while ((match = exRegex.exec(raw)) !== null) {
        let parts = match[1].split(/,|và/).map(s => s.trim()).filter(Boolean);
        exclude.push(...parts);
    }
    raw = raw.replace(/\(trừ mã [^\)]+\)/ig, ''); 
    
    const rangeRegex = /Từ\s+([A-Z0-9.]+)\s+đến\s+([A-Z0-9.]+)/ig;
    while ((match = rangeRegex.exec(raw)) !== null) {
        codes.push(...expandRange(match[1], match[2]));
    }
    raw = raw.replace(/Từ\s+[A-Z0-9.]+\s+đến\s+[A-Z0-9.]+/ig, '');
    
    let parts = raw.split(/,|và|\s+/).map(s => s.trim()).filter(Boolean);
    for(let p of parts) {
        if (/^[A-Z][0-9.]+$/.test(p)) {
            codes.push(p);
        }
    }
    
    return {codes, exclude};
}

async function main() {
    console.log('Reset is_phu_luc_2_tt25...');
    await prisma.icd10Catalog.updateMany({
        data: { is_phu_luc_2_tt25: false }
    });

    const workbook = xlsx.readFile('mau/phucluc2tt012025.xlsx');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[2]) continue;
        
        const str = String(row[2]);
        const { codes, exclude } = parseAdvanced(str);
        
        for (const code of codes) {
            await prisma.icd10Catalog.updateMany({
                where: { 
                    OR: [
                        { ma_benh: code },
                        { ma_chi_tiet: { startsWith: code } }
                    ]
                },
                data: { is_phu_luc_2_tt25: true }
            });
        }
        
        // Exact match for exclusions instead of startsWith
        for (const ex of exclude) {
            await prisma.icd10Catalog.updateMany({
                where: { ma_chi_tiet: ex },
                data: { is_phu_luc_2_tt25: false }
            });
        }
    }
    
    // Yêu cầu "chốt": Tất cả bệnh PL1 thì cũng thuộc PL2
    await prisma.icd10Catalog.updateMany({
        where: { is_phu_luc_1_tt25: true },
        data: { is_phu_luc_2_tt25: true }
    });

    const finalCount = await prisma.icd10Catalog.count({
        where: { is_phu_luc_2_tt25: true }
    });
    console.log('Total is_phu_luc_2_tt25 = true:', finalCount);
    
    // Xuất ra SQL file
    const data = await prisma.icd10Catalog.findMany({
        where: { is_phu_luc_2_tt25: true },
        select: { ma_chi_tiet: true }
    });
    const codesSql = data.map(d => d.ma_chi_tiet).filter(Boolean);
    const sql = `UPDATE "Icd10Catalog" SET "is_phu_luc_2_tt25" = false;
UPDATE "Icd10Catalog" SET "is_phu_luc_2_tt25" = true WHERE "ma_chi_tiet" IN ('${codesSql.join("', '")}');
UPDATE "Icd10Catalog" SET "is_phu_luc_2_tt25" = true WHERE "is_phu_luc_1_tt25" = true;`;
    
    fs.writeFileSync('update_phuluc2.sql', sql);
    console.log('Exported update_phuluc2.sql successfully.');
}

main().finally(() => prisma.$disconnect());
