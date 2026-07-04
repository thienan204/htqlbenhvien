const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'Phu luc Bang danh muc ICD10_FINAL .xlsx');
const workbook = XLSX.readFile(filePath);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];

const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('Total rows:', data.length);
for(let i=0; i<Math.min(50, data.length); i++) {
    const row = data[i];
    console.log(`ROW ${i+1}:`);
    for(let j=0; j<Math.min(20, row.length); j++) {
        if (row[j]) console.log(`  Col ${j+1}: ${row[j]}`);
    }
}
