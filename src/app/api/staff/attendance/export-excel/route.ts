import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/actions/auth';
import { buildAttendanceExcelBuffer } from './attendanceExcelBuilder';

export async function GET(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const monthYear = searchParams.get('monthYear') || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const type = searchParams.get('type') || 'CHAM_CONG';
        const ma_khoa = searchParams.get('ma_khoa') || 'KP046';
        const startDate = searchParams.get('startDate') || undefined;
        const endDate = searchParams.get('endDate') || undefined;
        const fileNamingStyle = (searchParams.get('fileNamingStyle') || 'MONTHLY') as 'MONTHLY' | 'DAILY';
        const targetDate = searchParams.get('targetDate') || undefined;
        const creatorName = user.name || user.username || 'Người chấm công';

        const { buffer, filename } = await buildAttendanceExcelBuffer({
            type,
            monthYear,
            ma_khoa,
            creatorName,
            startDate,
            endDate,
            fileNamingStyle,
            targetDate
        });

        const encodedFilename = encodeURIComponent(filename);

        return new Response(new Uint8Array(buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`
            }
        });
    } catch (error: any) {
        console.error('Error exporting Excel:', error);
        return NextResponse.json({ error: error.message || 'Lỗi khi xuất file Excel' }, { status: 500 });
    }
}
