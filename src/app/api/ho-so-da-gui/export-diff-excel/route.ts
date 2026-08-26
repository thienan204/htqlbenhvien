import { NextResponse } from 'next/server';
import * as exceljs from 'exceljs';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const diffMatches = body.diffMatches || [];

        if (!diffMatches || diffMatches.length === 0) {
            return NextResponse.json({ error: 'Không có dữ liệu để xuất' }, { status: 400 });
        }

        const workbook = new exceljs.Workbook();
        const sheet = workbook.addWorksheet('Lech_Chi_Phi', {
            views: [{ showGridLines: false }]
        });

        // Định nghĩa cột
        sheet.columns = [
            { header: 'STT', key: 'stt', width: 6 },
            { header: 'Nguồn', key: 'nguon', width: 18 },
            { header: 'Mã BN', key: 'maBN', width: 15 },
            { header: 'Họ Tên', key: 'hoTen', width: 22 },
            { header: 'Ngày Sinh', key: 'ngaySinh', width: 15 },
            { header: 'Giới Tính', key: 'gioiTinh', width: 10 },
            { header: 'Mã Bệnh', key: 'maBenh', width: 10 },
            { header: 'Ngày Vào', key: 'ngayVao', width: 20 },
            { header: 'Ngày Ra', key: 'ngayRa', width: 20 },
            { header: 'Tổng Chi', key: 'tongChi', width: 15, style: { numFmt: '#,##0' } },
            { header: 'Tổng Chi BH', key: 'tongChiBH', width: 15, style: { numFmt: '#,##0' } },
            { header: 'Bảo Hiểm TT', key: 'baoHiemTT', width: 15, style: { numFmt: '#,##0' } },
            { header: 'Bệnh Nhân CCT', key: 'benhNhanCCT', width: 15, style: { numFmt: '#,##0' } },
            { header: 'Bệnh Nhân TT', key: 'benhNhanTT', width: 15, style: { numFmt: '#,##0' } },
        ];

        // Style header
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FF333333' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 25;

        // Bỏ viền cho Header nhưng thêm border mỏng
        headerRow.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
            };
        });

        // Hàm helper bôi đỏ ô lệch
        const applyDiffStyle = (cell: exceljs.Cell, val: any, diffAmount?: any) => {
            // Đối với text
            if (typeof diffAmount === 'boolean' && diffAmount) {
                cell.font = { color: { argb: 'FFEF4444' }, bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
            } 
            // Đối với số (có chênh lệch != 0)
            else if (typeof diffAmount === 'number' && diffAmount !== 0) {
                cell.font = { color: { argb: 'FFEF4444' }, bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
                // Nối thêm text báo chênh lệch (+/-) vào dưới. exceljs hỗ trợ richText
                const diffStr = diffAmount > 0 ? `+${diffAmount.toLocaleString('vi-VN')}` : `${diffAmount.toLocaleString('vi-VN')}`;
                cell.value = {
                    richText: [
                        { text: (val === null || val === undefined ? '0' : val.toLocaleString('vi-VN')) + '\n' },
                        { font: { color: { argb: 'FFEF4444' }, bold: true, size: 9 }, text: diffStr }
                    ]
                };
                cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'right' };
            }
        };

        let currentRowIndex = 2;

        const formatYYYYMMDD = (val: any) => {
            if (!val || typeof val !== 'string') return val;
            const clean = val.trim();
            if (/^\d{8}$/.test(clean)) {
                return `${clean.substring(6, 8)}/${clean.substring(4, 6)}/${clean.substring(0, 4)}`;
            }
            if (/^\d{12}$/.test(clean)) {
                return `${clean.substring(6, 8)}/${clean.substring(4, 6)}/${clean.substring(0, 4)} ${clean.substring(8, 10)}:${clean.substring(10, 12)}`;
            }
            return val;
        };

        diffMatches.forEach((m: any, idx: number) => {
            const stt = idx + 1;

            // --- DÒNG 1: Mẫu 01/BH-C79 (Excel) ---
            const r1 = sheet.addRow({
                stt: stt,
                nguon: 'Mẫu 01/BH-C79',
                maBN: m.excel.maBN || '',
                hoTen: m.excel.hoTen,
                ngaySinh: formatYYYYMMDD(m.excel.ngaySinh),
                gioiTinh: m.excel.gioiTinh,
                maBenh: m.excel.chanDoan,
                ngayVao: formatYYYYMMDD(m.excel.ngayVao),
                ngayRa: formatYYYYMMDD(m.excel.ngayRa),
                tongChi: m.excel.tongChi,
                tongChiBH: m.excel.tongChiBH,
                baoHiemTT: m.excel.baoHiemTT,
                benhNhanCCT: m.excel.benhNhanCCT,
                benhNhanTT: m.excel.benhNhanTT
            });

            r1.height = 30;
            r1.getCell('nguon').font = { color: { argb: 'FF16A34A' }, bold: true }; // Màu xanh lá
            
            // Căn giữa STT và Nguồn
            r1.getCell('stt').alignment = { vertical: 'middle', horizontal: 'center' };
            r1.getCell('nguon').alignment = { vertical: 'middle', horizontal: 'center' };
            r1.getCell('hoTen').alignment = { vertical: 'middle' };

            // Thêm viền nhạt
            r1.eachCell((cell) => {
                cell.border = {
                    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    top: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                };
            });

            // --- DÒNG 2: Cổng GĐBHXH (DB) ---
            const r2 = sheet.addRow({
                stt: '',
                nguon: 'Cổng GĐBHXH',
                maBN: m.db.maBN || '',
                hoTen: m.db.hoTen,
                ngaySinh: m.db.ngaySinh,
                gioiTinh: m.db.gioiTinh,
                maBenh: m.db.chanDoan,
                ngayVao: m.db.ngayVao,
                ngayRa: m.db.ngayRa,
                tongChi: m.db.tongChi,
                tongChiBH: m.db.tongChiBH,
                baoHiemTT: m.db.baoHiemTT,
                benhNhanCCT: m.db.benhNhanCCT,
                benhNhanTT: m.db.benhNhanTT
            });

            r2.height = 40;
            r2.getCell('nguon').font = { color: { argb: 'FF2563EB' }, bold: true }; // Màu xanh dương
            r2.getCell('nguon').alignment = { vertical: 'middle', horizontal: 'center' };
            r2.getCell('hoTen').alignment = { vertical: 'middle' };

            // Thêm viền nhạt và viền gạch dưới mỏng phân cách các bệnh nhân
            r2.eachCell((cell) => {
                cell.border = {
                    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                };
            });

            // Merge ô STT 2 dòng
            sheet.mergeCells(`A${currentRowIndex}:A${currentRowIndex + 1}`);

            // Kiểm tra và bôi đỏ các ô sai lệch trên dòng DB
            const diff = m.diff || {};
            applyDiffStyle(r2.getCell('hoTen'), m.db.hoTen, diff.hoTen);
            applyDiffStyle(r2.getCell('ngaySinh'), m.db.ngaySinh, diff.ngaySinh);
            applyDiffStyle(r2.getCell('gioiTinh'), m.db.gioiTinh, diff.gioiTinh);
            applyDiffStyle(r2.getCell('maBenh'), m.db.chanDoan, diff.chanDoan);
            applyDiffStyle(r2.getCell('ngayVao'), m.db.ngayVao, diff.ngayVao);
            applyDiffStyle(r2.getCell('ngayRa'), m.db.ngayRa, diff.ngayRa);
            
            applyDiffStyle(r2.getCell('tongChi'), m.db.tongChi, diff.tongChi);
            applyDiffStyle(r2.getCell('tongChiBH'), m.db.tongChiBH, diff.tongChiBH);
            applyDiffStyle(r2.getCell('baoHiemTT'), m.db.baoHiemTT, diff.baoHiemTT);
            applyDiffStyle(r2.getCell('benhNhanCCT'), m.db.benhNhanCCT, diff.benhNhanCCT);
            applyDiffStyle(r2.getCell('benhNhanTT'), m.db.benhNhanTT, diff.benhNhanTT);

            currentRowIndex += 2;
        });

        const buffer = await workbook.xlsx.writeBuffer();

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="HoSoLechChiPhi.xlsx"',
            },
        });

    } catch (error: any) {
        console.error('Lỗi khi xuất Excel đối chiếu:', error);
        return NextResponse.json(
            { error: 'Có lỗi xảy ra: ' + error.message },
            { status: 500 }
        );
    }
}
