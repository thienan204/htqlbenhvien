import fs from 'fs';
import { processExcelImport } from './src/services/excelImportService';

async function main() {
    try {
        console.log('Reading file dsnv.xlsx...');
        const buffer = fs.readFileSync('mau/dsnv.xlsx');
        console.log('File read successfully, processing import...');
        
        const successCount = await processExcelImport(buffer);
        console.log(`Import successful! ${successCount} staff members imported.`);
    } catch (error) {
        console.error('Import failed:', error);
    }
}

main();
