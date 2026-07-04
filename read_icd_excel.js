const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'Phu luc Bang danh muc ICD10_FINAL .xlsx');
console.log('Reading:', filePath);

const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('Total rows:', data.length);

if (data.length > 0) {
    // Print the first 5 rows to understand the structure
    for(let i=0; i<Math.min(10, data.length); i++) {
        console.log(`\n--- ROW ${i+1} ---`);
        const row = data[i];
        for(let j=0; j<row.length; j++) {
            if (row[j] !== undefined && row[j] !== null && row[j] !== '') {
                console.log(`Col ${j+1}: ${row[j]}`);
            }
        }
    }
}
