import fs from 'fs';
import * as xlsx from 'xlsx';

function main() {
    console.log('Reading file dsnv.xlsx...');
    const buffer = fs.readFileSync('mau/dsnv.xlsx');
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    console.log("Headers (Row 1):", rawData[0]);
    console.log("Sample Data (Row 3):", rawData[2]);
}

main();
