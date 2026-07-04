const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'Phu luc Bang danh muc ICD10_FINAL .xlsx');
const workbook = XLSX.readFile(filePath);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];

const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

for(let i=0; i<5; i++) {
    console.log(`\n--- ROW ${i+1} ---`);
    const row = data[i];
    if (!row) continue;
    for(let j=0; j<row.length; j++) {
        if (row[j]) console.log(`Col ${j} (${String.fromCharCode(65+j)}): ${row[j]}`);
    }
}
