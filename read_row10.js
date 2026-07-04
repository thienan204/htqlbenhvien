const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'Phu luc Bang danh muc ICD10_FINAL .xlsx');
const workbook = XLSX.readFile(filePath);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];

const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('--- ROW 10 ---');
const row = data[9]; // index 9 is row 10
for(let j=0; j<row.length; j++) {
    console.log(`Col ${j} (${String.fromCharCode(65+j)}): ${row[j]}`);
}
