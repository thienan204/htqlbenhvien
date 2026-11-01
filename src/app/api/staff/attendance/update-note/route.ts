import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUserFromRequest(req);
        const body = await req.json();
        const { staffId, ma_khoa, monthYear, note } = body;

        if (!staffId || !monthYear) {
            return NextResponse.json({ error: 'Thiếu staffId hoặc monthYear' }, { status: 400 });
        }

        const updated = await prisma.staffMonthlyAttendanceNote.upsert({
            where: {
                staffId_monthYear: {
                    staffId,
                    monthYear
                }
            },
            update: {
                note: (note || '').trim(),
                ma_khoa: ma_khoa || 'KP046',
                updatedBy: user?.name || user?.username || 'Hệ thống'
            },
            create: {
                staffId,
                ma_khoa: ma_khoa || 'KP046',
                monthYear,
                note: (note || '').trim(),
                updatedBy: user?.name || user?.username || 'Hệ thống'
            }
        });

        return NextResponse.json({
            success: true,
            data: updated
        });
    } catch (error: any) {
        console.error('Error updating monthly attendance note:', error);
        return NextResponse.json(
            { error: error.message || 'Lỗi khi cập nhật ghi chú tháng' },
            { status: 500 }
        );
    }
}
