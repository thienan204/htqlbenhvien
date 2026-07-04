const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'mau', 'Phu luc Bang danh muc ICD10_FINAL .xlsx');
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
for (let i = 2; i < data.length; i++) {
    const row = data[i];
    for (let j = 23; j <= 28; j++) {
        if (row[j] && String(row[j]).trim() !== '') {
            console.log(`Row ${i}, Col ${j}: '${row[j]}'`);
            if (i > 100) break; // just print a few
        }
    }
}
