const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'Phu luc Bang danh muc ICD10_FINAL .xlsx');
const workbook = XLSX.readFile(filePath);

console.log('Sheet Names:');
workbook.SheetNames.forEach(name => console.log(name));

const sheetName = workbook.SheetNames[1]; // Let's check the second sheet if it exists
if (sheetName) {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log(`\n--- Sheet 2 (${sheetName}) Rows: ${data.length} ---`);
    for(let i=0; i<Math.min(10, data.length); i++) {
        console.log(`ROW ${i+1}:`, data[i]);
    }
}
