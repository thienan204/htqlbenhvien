const XLSX = require('xlsx');

const filePath = 'd:/1.ProjectBVDKLS/htqlbenhvien/mau/rptBAOCAO_PTTT_TDCN_V1_987.xlsx';
const workbook = XLSX.readFile(filePath);

const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Get merges
console.log('--- Merges ---');
console.log(worksheet['!merges']);

// Get JSON data (raw array of arrays)
console.log('\n--- First 10 Rows ---');
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
for (let i = 0; i < Math.min(10, data.length); i++) {
    console.log(`Row ${i + 1}:`, JSON.stringify(data[i]));
}
