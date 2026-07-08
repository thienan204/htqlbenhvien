const XLSX = require('xlsx');

function readHeaders() {
    try {
        const wb = XLSX.readFile('mau/02.MAU_02DM_NHANVIEN.xlsx');
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        
        // Get headers (first row)
        const headers = [];
        const range = XLSX.utils.decode_range(sheet['!ref']);
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = sheet[XLSX.utils.encode_cell({c: C, r: 0})];
            if (cell && cell.v) {
                headers.push(cell.v);
            } else {
                headers.push(`Column_${C+1}`);
            }
        }
        
        console.log("Headers in file:");
        console.log(headers);
    } catch(e) {
        console.error("Error reading file:", e);
    }
}

readHeaders();
