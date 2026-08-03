const ExcelJS = require('exceljs');
const path = require('path');

async function run() {
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile('mau/bieu1a.xlsx');
        const worksheet = workbook.getWorksheet(1);
        
        // Cập nhật dòng 8 với các từ khóa
        const row = worksheet.getRow(8);
        row.getCell(1).value = '{{stt}}';
        row.getCell(2).value = '{{ma_nv}}';
        row.getCell(3).value = '{{ho_ten}}';
        row.getCell(4).value = '{{nam_sinh}}';
        row.getCell(5).value = '{{gioi_tinh}}';
        row.getCell(6).value = '{{cccd}}';
        row.getCell(7).value = '{{chuc_danh}}';
        row.getCell(8).value = '{{vi_tri}}';
        row.getCell(9).value = '{{loai_hd}}';
        row.getCell(10).value = '{{thoi_gian}}';
        row.getCell(11).value = '{{cchn_pham_vi}}';
        row.getCell(12).value = '{{cchn_so}}';
        row.getCell(13).value = '{{cchn_ngay_cap}}';
        row.getCell(14).value = '{{cchn_noi_cap}}';
        row.getCell(15).value = '{{ghi_chu}}';
        
        await workbook.xlsx.writeFile('src/templates/bieu1a_template.xlsx');
        console.log('Đã cập nhật file mẫu thành công!');
    } catch (e) {
        console.error('Lỗi:', e);
    }
}
run();
