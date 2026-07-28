import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { formatDateTime } from './specialized-rules-engine';

export const exportDuplicateDoctorExcel = async (data: any[], ruleName: string) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Báo cáo trùng Bác Sĩ');

    const columns = [
        { header: 'STT', key: 'stt', width: 5 },
        { header: 'Mã LK', key: 'MA_LK', width: 15 },
        { header: 'Mã BN', key: 'MA_BN', width: 15 },
        { header: 'Họ Tên', key: 'HO_TEN', width: 25 },
        { header: 'Mã Bác sĩ', key: 'MA_BS', width: 15 },
        { header: 'Họ Tên BS', key: 'TEN_BAC_SI', width: 25 },
        { header: 'Trình độ', key: 'TRINH_DO', width: 15 },
        { header: 'Ngày chỉ định', key: 'THOI_GIAN_YL', width: 20 },
        { header: 'Loại', key: 'TYPE', width: 10 },
        { header: 'Mã', key: 'MA_LOAI', width: 15 },
        { header: 'Tên Dịch Vụ / Thuốc', key: 'TEN_LOAI', width: 35 },
        { header: 'Mã Khoa', key: 'MA_KHOA', width: 10 },
        { header: 'Tên Khoa', key: 'TEN_KHOA', width: 20 },
    ];
    sheet.columns = columns;

    data.forEach((item, index) => {
        const row = sheet.addRow({
            stt: index + 1,
            MA_LK: item.MA_LK,
            MA_BN: item.MA_BN,
            HO_TEN: item.HO_TEN,
            MA_BS: item._ma_bs || item.MA_BS,
            TEN_BAC_SI: item.TEN_BAC_SI,
            TRINH_DO: item.TRINH_DO,
            THOI_GIAN_YL: formatDateTime(item.THOI_GIAN_YL),
            TYPE: item.TYPE,
            MA_LOAI: item.MA_LOAI,
            TEN_LOAI: item.TEN_LOAI,
            MA_KHOA: item.MA_KHOA,
            TEN_KHOA: item.TEN_KHOA
        });

        if (item.rowColor) {
            row.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF' + item.rowColor.replace('#', '').toUpperCase() }
                };
            });
        }
    });

    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const safeName = ruleName.replace(/[/\\?%*:|"<>]/g, '-');
    saveAs(blob, `${safeName}_${new Date().getTime()}.xlsx`);
};

export const exportDuplicateBedExcel = async (data: any[], ruleName: string) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Báo cáo trùng lặp');

    const columns = [
        { header: 'STT', key: 'stt', width: 5 },
        { header: 'Mã LK', key: 'MA_LK', width: 15 },
        { header: 'Mã BN', key: 'MA_BN', width: 15 },
        { header: 'Mã Thẻ BHYT', key: 'MA_THE_BHYT', width: 20 },
        { header: 'Họ Tên', key: 'HO_TEN', width: 25 },
        { header: 'Mã Khoa', key: 'MA_KHOA', width: 10 },
        { header: 'Tên Khoa', key: 'TEN_KHOA', width: 20 },
        { header: 'Mã Bác sĩ', key: 'MA_BAC_SI', width: 15 },
        { header: 'Tên Bác sĩ', key: 'TEN_BAC_SI', width: 25 },
        { header: 'Người TH', key: 'NGUOI_THUC_HIEN', width: 15 },
        { header: 'Tên Người TH', key: 'TEN_NGUOI_THUC_HIEN', width: 25 },
        { header: 'Mã Giường/Máy', key: 'KEY_VALUE', width: 15 },
        { header: 'SL', key: 'SOLUONG', width: 5 },
        { header: 'Ngày Vào', key: 'NGAY_VAO', width: 20 },
        { header: 'Ngày Ra', key: 'NGAY_RA', width: 20 },
        { header: 'Ngày YL', key: 'NGAY_YL', width: 20 },
        { header: 'Ngày TH YL', key: 'NGAY_TH_YL', width: 20 },
        { header: 'Ngày KQ', key: 'NGAY_KQ', width: 20 },
        { header: 'Mã Dịch Vụ', key: 'MA_DICH_VU', width: 15 },
        { header: 'Tên Dịch Vụ', key: 'TEN_DICH_VU', width: 35 },
    ];
    sheet.columns = columns;

    data.forEach((item, index) => {
        const row = sheet.addRow({
            stt: index + 1,
            MA_LK: item.MA_LK,
            MA_BN: item.MA_BN,
            MA_THE_BHYT: item.MA_THE_BHYT,
            HO_TEN: item.HO_TEN,
            MA_KHOA: item.MA_KHOA,
            TEN_KHOA: item.TEN_KHOA,
            MA_BAC_SI: item.MA_BAC_SI,
            TEN_BAC_SI: item.TEN_BAC_SI,
            NGUOI_THUC_HIEN: item.NGUOI_THUC_HIEN,
            TEN_NGUOI_THUC_HIEN: item.TEN_NGUOI_THUC_HIEN,
            KEY_VALUE: item.KEY_VALUE ? String(item.KEY_VALUE).split('-')[0] : '',
            SOLUONG: item.SOLUONG,
            NGAY_VAO: formatDateTime(item.NGAY_VAO),
            NGAY_RA: formatDateTime(item.NGAY_RA),
            NGAY_YL: formatDateTime(item.NGAY_YL),
            NGAY_TH_YL: formatDateTime(item.NGAY_TH_YL),
            NGAY_KQ: formatDateTime(item.NGAY_KQ),
            MA_DICH_VU: item.MA_DICH_VU,
            TEN_DICH_VU: item.TEN_DICH_VU
        });

        if (item.rowColor) {
            row.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF' + item.rowColor.replace('#', '').toUpperCase() }
                };
            });
        }
    });

    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const safeName = ruleName.replace(/[/\\?%*:|"<>]/g, '-');
    saveAs(blob, `${safeName}_${new Date().getTime()}.xlsx`);
};
