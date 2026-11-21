import { NextResponse } from 'next/server';
import AdmZip from 'adm-zip';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';
import { buildAttendanceExcelBuffer, getSafeDeptName } from '../export-excel/attendanceExcelBuilder';

export async function POST(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const body = await request.json();
        const {
            monthYear = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
            ma_khoa = user.ma_khoa || 'KP046',
            fileNamingStyle = 'MONTHLY',
            targetDate,
            selectedKeys = ['CHAM_CONG', 'CHAM_TRUC', 'SO_DOI_SOAT', 'CHAM_THEM_GIO', 'CHAM_DOC_HAI']
        } = body;

        const department = await prisma.department.findUnique({
            where: { ma_khoa },
            select: { ten_khoa: true, ma_khoa: true }
        });
        const safeDept = getSafeDeptName(department?.ten_khoa, ma_khoa);
        const [year, month] = monthYear.split('-');
        const dateSuffix = fileNamingStyle === 'DAILY' ? `_${targetDate || new Date().toISOString().split('T')[0]}` : '';
        const zipFileName = `SaoLuu_ChamCong_${safeDept}_T${month}_${year}${dateSuffix}.zip`;

        const zip = new AdmZip();
        const files: Array<{
            key: string;
            fileName: string;
            base64: string;
            size: number;
        }> = [];

        const keyMap: Record<string, string> = {
            CHAM_CONG: 'Bảng Chấm Công',
            CHAM_TRUC: 'Bảng Chấm Trực',
            SO_DOI_SOAT: 'Sổ Đối Soát Nghỉ Bù',
            CHAM_THEM_GIO: 'Bảng Chấm Thêm Giờ',
            CHAM_DOC_HAI: 'Bảng Chấm Độc Hại'
        };

        for (const key of selectedKeys) {
            if (!keyMap[key]) continue;
            const { buffer, filename } = await buildAttendanceExcelBuffer({
                type: key,
                monthYear,
                ma_khoa,
                creatorName: user.name || user.username || 'Người chấm công',
                fileNamingStyle,
                targetDate
            });

            zip.addFile(filename, buffer);

            files.push({
                key,
                fileName: filename,
                base64: buffer.toString('base64'),
                size: buffer.length
            });
        }

        const zipBuffer = zip.toBuffer();
        const zipBase64 = zipBuffer.toString('base64');

        return NextResponse.json({
            success: true,
            zipFileName,
            zipBase64,
            files,
            totalFiles: files.length,
            deptName: department?.ten_khoa || ma_khoa
        });
    } catch (error: any) {
        console.error('Lỗi khi tạo gói ZIP:', error);
        return NextResponse.json({ error: error.message || 'Lỗi server khi nén file' }, { status: 500 });
    }
}

