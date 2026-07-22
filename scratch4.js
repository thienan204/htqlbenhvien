const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');

const prisma = new PrismaClient();

function expandRange(start, end) {
    const prefix = start.charAt(0);
    const startNum = parseInt(start.substring(1));
    const endNum = parseInt(end.substring(1));
    const codes = [];
    for (let i = startNum; i <= endNum; i++) {
        codes.push(`${prefix}${i.toString().padStart(2, '0')}`);
    }
    return codes;
}

function parseIcdString(str) {
    if (!str) return { codes: [], exclude: [] };
    let raw = str.replace(/[\*\+†]/g, '').trim();
    let codes = [];
    let exclude = [];
    
    const excludeMatch = raw.match(/\(trừ mã ([^\)]+)\)/i);
    if (excludeMatch) {
        exclude = excludeMatch[1].split(',').map(s => s.trim());
        raw = raw.replace(excludeMatch[0], '');
    }
    
    const rangeRegex = /Từ\s+([A-Z0-9.]+)\s+đến\s+([A-Z0-9.]+)/ig;
    let match;
    let hasRange = false;
    while ((match = rangeRegex.exec(raw)) !== null) {
        hasRange = true;
        codes.push(...expandRange(match[1], match[2]));
    }
    
    if (!hasRange) {
        raw = raw.replace(/\([^\)]+\)/g, '');
        const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
        for (const p of parts) {
            if (p) codes.push(p);
        }
    }
    
    return { codes, exclude };
}

async function main() {
    console.log('Reset is_phu_luc_1_tt25...');
    await prisma.icd10Catalog.updateMany({
        data: { is_phu_luc_1_tt25: false }
    });

    const workbook = xlsx.readFile('mau/phụluc1tt25.xlsx');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[2]) continue;
        
        const str = row[2];
        if (str === '(trừ mã C38.4)') continue;

        const { codes, exclude } = parseIcdString(str);
        
        for (const code of codes) {
            // Use startsWith to match suffixes like †, *, + and sub-codes
            await prisma.icd10Catalog.updateMany({
                where: { 
                    OR: [
                        { ma_benh: code },
                        { ma_chi_tiet: { startsWith: code } }
                    ]
                },
                data: { is_phu_luc_1_tt25: true }
            });
        }
        
        for (const ex of exclude) {
            await prisma.icd10Catalog.updateMany({
                where: { ma_chi_tiet: { startsWith: ex } },
                data: { is_phu_luc_1_tt25: false }
            });
        }
    }
    
    // Explicit exclusions from the file (trừ mã)
    await prisma.icd10Catalog.updateMany({
        where: { 
            OR: [
                { ma_chi_tiet: { startsWith: 'C38.4' } },
                { ma_chi_tiet: { startsWith: 'D61.9' } },
                { ma_chi_tiet: { startsWith: 'C83.5' } }
            ]
        },
        data: { is_phu_luc_1_tt25: false }
    });

    const finalCount = await prisma.icd10Catalog.count({
        where: { is_phu_luc_1_tt25: true }
    });
    console.log('Total is_phu_luc_1_tt25 = true:', finalCount);
}

main().finally(() => prisma.$disconnect());
