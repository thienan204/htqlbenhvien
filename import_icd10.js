const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runImport() {
    console.log('Starting ICD-10 Import...');
    const filePath = path.join(__dirname, 'Phu luc Bang danh muc ICD10_FINAL .xlsx');
    
    if (!fs.existsSync(filePath)) {
        console.error('File not found!');
        return;
    }

    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`Read ${data.length} rows from Excel.`);

    await prisma.icd10Catalog.deleteMany({});
    console.log('Cleared existing Icd10Catalog data.');

    const recordsToInsert = [];
    const seenCodes = new Set();

    // Data starts at row index 4 (row 5 in Excel)
    for (let i = 4; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 18) continue;

        const ma_chuong = row[1] ? String(row[1]).trim() : null;
        const ma_nhom = row[2] ? String(row[2]).trim() : null;
        const ten_nhom = row[4] ? String(row[4]).trim() : null;
        const ma_loai = row[5] ? String(row[5]).trim() : null;
        const ten_loai = row[7] ? String(row[7]).trim() : null;
        const ma_benh = row[14] ? String(row[14]).trim() : null;
        const ten_benh = row[16] ? String(row[16]).trim() : null;
        const ma_chi_tiet = row[17] ? String(row[17]).trim() : null;
        const ten_chi_tiet = row[21] ? String(row[21]).trim() : null;

        if (!ma_chi_tiet) continue; // Skip if no specific code
        
        // Prevent duplicates
        if (seenCodes.has(ma_chi_tiet)) continue;
        seenCodes.add(ma_chi_tiet);

        const is_not_main_disease = !!row[23];
        const not_recommended_main = !!row[24];
        const requires_more_specific = !!row[25];
        const is_death_cause_only = !!row[26];
        const is_female_only = !!row[27];
        const is_male_only = !!row[28];

        recordsToInsert.push({
            ma_chuong,
            ten_chuong: '', // Excel doesn't have ten_chuong in Vietnamese mapped easily? Wait, col 4 is ten chuong!
            // Ah, let's fix:
            // Col 1 (B): STT CHƯƠNG (I, II, III...)
            // Col 4 (E): TÊN CHƯƠNG (Bệnh truyền nhiễm và ký sinh trùng)
            ma_nhom,
            ten_nhom, // Wait, Col 2 is Phạm vi mã nhóm bệnh (A00-B99), Col 4 is TÊN CHƯƠNG
            // Let's refine based on headers:
            // Col 1: Chuong
            // Col 4: Ten Chuong
            // Col 5: Ma Khoi (A00-A09)
            // Col 7: Ten Khoi (Bệnh truyền nhiễm đường ruột)
            
            ma_loai: ma_loai,
            ten_loai: ten_loai,
            ma_benh,
            ten_benh,
            ma_chi_tiet,
            ten_chi_tiet,
            is_not_main_disease,
            not_recommended_main,
            requires_more_specific,
            is_death_cause_only,
            is_female_only,
            is_male_only
        });
        
        // Fix the mapping:
        recordsToInsert[recordsToInsert.length - 1].ten_chuong = row[4] ? String(row[4]).trim() : null;
        recordsToInsert[recordsToInsert.length - 1].ma_nhom = row[2] ? String(row[2]).trim() : null; // PHẠM VI MÃ NHÓM BỆNH
        recordsToInsert[recordsToInsert.length - 1].ten_nhom = row[7] ? String(row[7]).trim() : null;
        recordsToInsert[recordsToInsert.length - 1].ma_loai = row[5] ? String(row[5]).trim() : null; // MÃ KHỐI
        recordsToInsert[recordsToInsert.length - 1].ten_loai = row[7] ? String(row[7]).trim() : null; // TÊN KHỐI
    }

    console.log(`Found ${recordsToInsert.length} valid unique records.`);

    const chunkSize = 5000;
    for (let c = 0; c < recordsToInsert.length; c += chunkSize) {
        const chunk = recordsToInsert.slice(c, c + chunkSize);
        await prisma.icd10Catalog.createMany({
            data: chunk,
            skipDuplicates: true
        });
        console.log(`Inserted chunk ${c / chunkSize + 1}`);
    }

    console.log('--- IMPORT COMPLETE ---');
}

runImport().finally(() => prisma.$disconnect());
