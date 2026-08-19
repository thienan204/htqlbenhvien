import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const maKhoa = searchParams.get('maKhoa');

        if (!date || !maKhoa) {
            return NextResponse.json({ success: false, message: 'Thiếu date hoặc maKhoa' }, { status: 400 });
        }

        const schedules = await prisma.clinicalScheduleRecord.findMany({
            where: {
                ngay_thuc_hien: date,
                ma_khoa: maKhoa
            },
            orderBy: {
                bat_dau: 'asc'
            }
        });

        return NextResponse.json({ success: true, schedules });
    } catch (error: any) {
        console.error('Error fetching schedules:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
