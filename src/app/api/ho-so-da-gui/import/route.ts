import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';

const prisma = new PrismaClient();

// Helper to normalize strings for comparison (preventing false positives from trailing spaces or undefined)
const norm = (val: any) => {
    if (val === null || val === undefined) return '';
    return String(val).trim();
};

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'Không tìm thấy file' }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Skip header row (assuming header is row 1)
        const rawData: any[] = xlsx.utils.sheet_to_json(sheet, { defval: '' });

        if (!rawData || rawData.length === 0) {
            return NextResponse.json({ error: 'File Excel không có dữ liệu' }, { status: 400 });
        }

        // Identify the "Mã liên kết" column based on the exact header names or keys
        // The headers from earlier check: 'STT', 'Mã liên kết', 'Mã thẻ', 'Mã BN', 'Họ tên', 'Ngày sinh', 'Giới tính', 'Ngày vào', 'Ngày ra', 'Chẩn đoán', 'Tổng chi', 'Bệnh nhân TT', 'Bệnh nhân CCT', 'Bảo hiểm TT', 'Ngày TT', 'Ngày gửi HS', 'Ngày đề nghị TT', 'Trạng thái HS', 'Trạng thái TT', 'Loại HS', 'Mã lỗi', 'Miêu tả'
        
        const importedRecords = rawData.map(row => ({
            stt: parseInt(row['STT']) || null,
            maLienKet: norm(row['Mã liên kết']),
            maThe: norm(row['Mã thẻ']),
            maBN: norm(row['Mã BN']),
            hoTen: norm(row['Họ tên']),
            ngaySinh: norm(row['Ngày sinh']),
            gioiTinh: norm(row['Giới tính']),
            ngayVao: norm(row['Ngày vào']),
            ngayRa: norm(row['Ngày ra']),
            chanDoan: norm(row['Chẩn đoán']),
            tongChi: parseFloat(row['Tổng chi']) || 0,
            benhNhanTT: parseFloat(row['Bệnh nhân TT']) || 0,
            benhNhanCCT: parseFloat(row['Bệnh nhân CCT']) || 0,
            baoHiemTT: parseFloat(row['Bảo hiểm TT']) || 0,
            ngayTT: norm(row['Ngày TT']),
            ngayGuiHS: norm(row['Ngày gửi HS']),
            ngayDeNghiTT: norm(row['Ngày đề nghị TT']),
            trangThaiHS: norm(row['Trạng thái HS']),
            trangThaiTT: norm(row['Trạng thái TT']),
            loaiHS: norm(row['Loại HS']),
            maLoi: norm(row['Mã lỗi']),
            mieuTa: norm(row['Miêu tả']),
        })).filter(r => r.maLienKet !== ''); // Filter out empty rows

        if (importedRecords.length === 0) {
            return NextResponse.json({ error: 'Không tìm thấy dữ liệu hợp lệ trong file (Thiếu cột "Mã liên kết")' }, { status: 400 });
        }

        const maLienKetList = [...new Set(importedRecords.map(r => r.maLienKet))];

        // Fetch the LATEST record for each maLienKet
        // Since Prisma doesn't have a simple "SELECT DISTINCT ON" like Postgres, we will fetch them grouped or ordered
        const existingRecords = await prisma.hoSoDaGui.findMany({
            where: {
                maLienKet: { in: maLienKetList }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Map to keep only the latest one per maLienKet
        const latestRecordsMap = new Map<string, any>();
        for (const record of existingRecords) {
            if (!latestRecordsMap.has(record.maLienKet)) {
                latestRecordsMap.set(record.maLienKet, record);
            }
        }

        let newCount = 0;
        let historyCount = 0;
        let skipCount = 0;

        const recordsToInsert = [];

        for (const newRec of importedRecords) {
            const existing = latestRecordsMap.get(newRec.maLienKet);

            if (!existing) {
                // New record
                recordsToInsert.push(newRec);
                newCount++;
            } else {
                // Compare fields
                const isChanged = 
                    norm(existing.maThe) !== newRec.maThe ||
                    norm(existing.maBN) !== newRec.maBN ||
                    norm(existing.hoTen) !== newRec.hoTen ||
                    norm(existing.ngaySinh) !== newRec.ngaySinh ||
                    norm(existing.gioiTinh) !== newRec.gioiTinh ||
                    norm(existing.ngayVao) !== newRec.ngayVao ||
                    norm(existing.ngayRa) !== newRec.ngayRa ||
                    norm(existing.chanDoan) !== newRec.chanDoan ||
                    (existing.tongChi || 0) !== newRec.tongChi ||
                    (existing.benhNhanTT || 0) !== newRec.benhNhanTT ||
                    (existing.benhNhanCCT || 0) !== newRec.benhNhanCCT ||
                    (existing.baoHiemTT || 0) !== newRec.baoHiemTT ||
                    norm(existing.ngayTT) !== newRec.ngayTT ||
                    norm(existing.ngayGuiHS) !== newRec.ngayGuiHS ||
                    norm(existing.ngayDeNghiTT) !== newRec.ngayDeNghiTT ||
                    norm(existing.trangThaiHS) !== newRec.trangThaiHS ||
                    norm(existing.trangThaiTT) !== newRec.trangThaiTT ||
                    norm(existing.loaiHS) !== newRec.loaiHS ||
                    norm(existing.maLoi) !== newRec.maLoi ||
                    norm(existing.mieuTa) !== newRec.mieuTa;

                if (isChanged) {
                    recordsToInsert.push(newRec);
                    historyCount++;
                } else {
                    skipCount++;
                }
            }
        }

        if (recordsToInsert.length > 0) {
            // Batch insert
            // Prisma createMany is efficient for this
            await prisma.hoSoDaGui.createMany({
                data: recordsToInsert
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Import thành công',
            total: importedRecords.length,
            newCount,
            historyCount,
            skipCount
        });

    } catch (error: any) {
        console.error('Import error:', error);
        return NextResponse.json({ error: 'Có lỗi xảy ra trong quá trình Import: ' + error.message }, { status: 500 });
    }
}
