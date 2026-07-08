const XLSX = require('xlsx');

function readRows() {
    try {
        const wb = XLSX.readFile('mau/02.MAU_02DM_NHANVIEN.xlsx');
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        console.log(JSON.stringify(jsonData.slice(0, 3), null, 2));
    } catch(e) {
        console.error("Error reading file:", e);
    }
}

readRows();
