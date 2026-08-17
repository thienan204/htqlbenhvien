const xlsx = require('xlsx');

const workbook = xlsx.readFile('mau/Copy of Danh_sach_chia_thoi_gian_theo_bac_si_Mau2_Khoa Y học cổ truyền_ngay_16-08-2026 (1).xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

for (let i = 0; i < data.length; i++) {
    const rowStr = data[i].join(' | ');
    if (rowStr.includes('VI VĂN VIỀN')) {
        console.log(rowStr);
    }
}
