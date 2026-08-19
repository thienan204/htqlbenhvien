import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { id, date, maKhoa, deleteAll } = body;

        if (deleteAll) {
            if (!date || !maKhoa) {
                return NextResponse.json({ success: false, message: 'Missing date or maKhoa for bulk delete' }, { status: 400 });
            }
            
            await prisma.clinicalScheduleRecord.deleteMany({
                where: {
                    ngay_thuc_hien: date,
                    ma_khoa: maKhoa
                }
            });
            
            return NextResponse.json({ success: true, message: 'Deleted all schedules for the date and department.' });
        } else {
            if (!id) {
                return NextResponse.json({ success: false, message: 'Missing record id' }, { status: 400 });
            }
            
            await prisma.clinicalScheduleRecord.delete({
                where: {
                    id: id
                }
            });
            
            return NextResponse.json({ success: true, message: 'Record deleted successfully.' });
        }

    } catch (error: any) {
        console.error('Error deleting schedule:', error);
        return NextResponse.json({ success: false, message: 'Database error: ' + error.message }, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}
