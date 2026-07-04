import fs from 'fs';
import * as xlsx from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Reading file dsnv.xlsx...');
        const buffer = fs.readFileSync('mau/dsnv.xlsx');
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (rawData.length < 2) {
            throw new Error('File Excel không có dữ liệu');
        }

        const headers = rawData[0];
        const rows = rawData.slice(2); // Bỏ qua dòng header và dòng số thứ tự

        const colIdx = {
            ten_khoa: headers.indexOf('Khoa phòng '),
            ma_khoa: headers.indexOf('Mã khoa phòng')
        };

        if (colIdx.ma_khoa === -1 || colIdx.ten_khoa === -1) {
            throw new Error('Không tìm thấy cột Mã khoa phòng hoặc Khoa phòng');
        }

        console.log(`Column Indexes: Mã khoa (${colIdx.ma_khoa}), Tên khoa (${colIdx.ten_khoa})`);

        const departmentsMap = new Map<string, string>();

        for (const row of rows) {
            const ma_khoa = row[colIdx.ma_khoa]?.toString().trim();
            const ten_khoa = row[colIdx.ten_khoa]?.toString().trim();

            if (ma_khoa && ten_khoa) {
                departmentsMap.set(ma_khoa, ten_khoa);
            }
        }

        console.log(`Tìm thấy ${departmentsMap.size} khoa phòng duy nhất. Bắt đầu import...`);

        let successCount = 0;
        for (const [ma_khoa, ten_khoa] of departmentsMap.entries()) {
            try {
                await prisma.department.upsert({
                    where: { ma_khoa },
                    update: { ten_khoa },
                    create: {
                        ma_khoa,
                        ten_khoa,
                        type: 'CLINICAL' // Mặc định
                    }
                });
                successCount++;
            } catch (err) {
                console.error(`Lỗi khi import khoa ${ma_khoa}:`, err);
            }
        }

        console.log(`Import danh mục Khoa Phòng thành công: ${successCount} bản ghi.`);

    } catch (error) {
        console.error('Lỗi quá trình import:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
