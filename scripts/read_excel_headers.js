const xlsx = require('xlsx');
const path = require('path');

try {
    const filePath = path.join(__dirname, '../mau/vattuthietbi_tbi.xlsx');
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON (only the first row)
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    if (data.length > 0) {
        console.log(JSON.stringify(data[0], null, 2));
    } else {
        console.log("No data found");
    }
} catch (error) {
    console.error("Error reading file:", error.message);
}
