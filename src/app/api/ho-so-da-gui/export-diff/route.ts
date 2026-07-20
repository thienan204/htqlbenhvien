import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as exceljs from 'exceljs';

const prisma = new PrismaClient();

const FIELD_LABELS: any = {
    maThe: 'Mã Thẻ',
    maBN: 'Mã BN',
    hoTen: 'Họ Tên',
    ngaySinh: 'Ngày Sinh',
    gioiTinh: 'Giới Tính',
    ngayVao: 'Ngày Vào',
    ngayRa: 'Ngày Ra',
    chanDoan: 'Chẩn Đoán',
    tongChi: 'Tổng Chi',
    benhNhanTT: 'Bệnh Nhân TT',
    benhNhanCCT: 'Bệnh Nhân CCT',
    baoHiemTT: 'Bảo Hiểm TT',
    ngayTT: 'Ngày TT',
    ngayGuiHS: 'Ngày Gửi',
    ngayDeNghiTT: 'Ngày Đề Nghị TT',
    trangThaiHS: 'Trạng Thái HS',
    trangThaiTT: 'Trạng Thái TT',
    loaiHS: 'Loại HS',
    maLoi: 'Mã Lỗi',
    mieuTa: 'Miêu Tả'
};

export async function GET(request: Request) {
    try {
        const searchParams = new URL(request.url).searchParams;
        const ngayRaTu = searchParams.get('ngayRaTu') || '';
        const ngayRaDen = searchParams.get('ngayRaDen') || '';

        // Find all maLienKet with more than 1 version
        const grouped = await prisma.hoSoDaGui.groupBy({
            by: ['maLienKet'],
            having: {
                maLienKet: {
                    _count: {
                        gt: 1
                    }
                }
            }
        });

        let maLienKetList = grouped.map(g => g.maLienKet);

        if (ngayRaTu || ngayRaDen) {
            let sql = `SELECT DISTINCT "maLienKet" FROM "HoSoDaGui" WHERE "ngayRa" IS NOT NULL AND "ngayRa" != ''`;
            const params: any[] = [];
            let paramIdx = 1;
            
            const extractDateSql = `
                CASE 
                    WHEN "ngayRa" LIKE '%/%/%' THEN SUBSTRING("ngayRa" FROM 7 FOR 4) || SUBSTRING("ngayRa" FROM 4 FOR 2) || SUBSTRING("ngayRa" FROM 1 FOR 2)
                    ELSE SUBSTRING("ngayRa" FROM 1 FOR 8)
                END
            `;

            if (ngayRaTu) {
                sql += ` AND ${extractDateSql} >= $${paramIdx++}`;
                params.push(ngayRaTu);
            }
            if (ngayRaDen) {
                sql += ` AND ${extractDateSql} <= $${paramIdx++}`;
                params.push(ngayRaDen);
            }

            const rawDateResults = await prisma.$queryRawUnsafe<{maLienKet: string}[]>(sql, ...params);
            const dateMaLienKets = new Set(rawDateResults.map(r => r.maLienKet));
            
            // Intersect with grouped maLienKetList
            maLienKetList = maLienKetList.filter(m => dateMaLienKets.has(m));
        }

        if (maLienKetList.length === 0) {
            return NextResponse.json({ error: 'Không có hồ sơ nào có sự thay đổi để xuất đối chiếu.' }, { status: 400 });
        }

        // Fetch all history for these maLienKet
        const allHistory = await prisma.hoSoDaGui.findMany({
            where: { maLienKet: { in: maLienKetList } },
            orderBy: [
                { maLienKet: 'asc' },
                { createdAt: 'asc' }
            ]
        });

        // Generate Diff Data
        const diffRows: any[] = [];

        // Group by maLienKet in memory
        const historyMap = new Map<string, any[]>();
        for (const rec of allHistory) {
            if (!historyMap.has(rec.maLienKet)) {
                historyMap.set(rec.maLienKet, []);
            }
            historyMap.get(rec.maLienKet)!.push(rec);
        }

        historyMap.forEach((records, maLK) => {
            if (records.length < 2) return;
            
            // Compare the LATEST (last in array) with the PREVIOUS (second to last)
            const latest = records[records.length - 1];
            const prev = records[records.length - 2];

            const fieldsToCompare = Object.keys(FIELD_LABELS);
            let hasChanges = false;
            
            for (const field of fieldsToCompare) {
                let oldVal = prev[field] ?? '';
                let newVal = latest[field] ?? '';
                
                // convert to string for safe comparison
                if (oldVal !== newVal && String(oldVal).trim() !== String(newVal).trim()) {
                    hasChanges = true;
                    diffRows.push({
                        maLienKet: maLK,
                        hoTen: latest.hoTen,
                        maThe: latest.maThe,
                        fieldName: FIELD_LABELS[field] || field,
                        oldValue: oldVal,
                        newValue: newVal,
                        updatedAt: latest.createdAt
                    });
                }
            }
            
            // If somehow no mapped fields changed but it's recorded, we can add a generic row
            if (!hasChanges) {
                diffRows.push({
                    maLienKet: maLK,
                    hoTen: latest.hoTen,
                    maThe: latest.maThe,
                    fieldName: 'Cập nhật hệ thống',
                    oldValue: 'N/A',
                    newValue: 'N/A',
                    updatedAt: latest.createdAt
                });
            }
        });

        // Create Excel WorkBook
        const workbook = new exceljs.Workbook();
        const sheet = workbook.addWorksheet('Đối Chiếu Hồ Sơ');

        sheet.columns = [
            { header: 'Mã Liên Kết', key: 'maLienKet', width: 15 },
            { header: 'Họ Tên', key: 'hoTen', width: 25 },
            { header: 'Mã Thẻ', key: 'maThe', width: 20 },
            { header: 'Trường Thay Đổi', key: 'fieldName', width: 20 },
            { header: 'Dữ Liệu Cũ', key: 'oldValue', width: 40 },
            { header: 'Dữ Liệu Mới', key: 'newValue', width: 40 },
            { header: 'Ngày Cập Nhật', key: 'updatedAt', width: 20 }
        ];

        // Styling headers
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

        for (const row of diffRows) {
            const addedRow = sheet.addRow({
                maLienKet: row.maLienKet,
                hoTen: row.hoTen,
                maThe: row.maThe,
                fieldName: row.fieldName,
                oldValue: row.oldValue,
                newValue: row.newValue,
                updatedAt: new Date(row.updatedAt).toLocaleString('vi-VN')
            });
            
            // Highlight New Value in soft green, Old Value in soft orange
            addedRow.getCell('newValue').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6FFED' } }; // Light green
            addedRow.getCell('oldValue').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0E6' } }; // Light orange
        }

        const buffer = await workbook.xlsx.writeBuffer();

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="DoiChieuHoSo.xlsx"',
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
