const XLSX = require('xlsx');
const path = process.argv[2];
try {
  const workbook = XLSX.readFile(path);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  console.log('Sheet Name:', sheetName);
  console.log('First 5 rows:');
  data.slice(0, 5).forEach((row, i) => console.log(`Row ${i + 1}:`, row));
} catch(e) {
  console.error(e);
}
