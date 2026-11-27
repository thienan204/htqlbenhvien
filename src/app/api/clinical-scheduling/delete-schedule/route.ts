import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeApiRequest, createDeleteSnapshot, SnapshotLimitError } from '@/lib/deleteProtection';

export async function POST(req: Request) {
    try {
        const auth = await authorizeApiRequest(req, { allowAuthenticated: true });
        if (auth.errorResponse) return auth.errorResponse;

        const body = await req.json();
        const { id, date, maKhoa, deleteAll } = body;

        if (deleteAll) {
            if (!date || !maKhoa) {
                return NextResponse.json({ success: false, message: 'Missing date or maKhoa for bulk delete' }, { status: 400 });
            }

            await prisma.$transaction(async (tx) => {
                const existingRecords = await tx.clinicalScheduleRecord.findMany({
                    where: {
                        ngay_thuc_hien: date,
                        ma_khoa: maKhoa
                    }
                });

                if (existingRecords.length > 0) {
                    await createDeleteSnapshot({
                        tx,
                        tableName: 'ClinicalScheduleRecord',
                        displayName: `Lịch trực lâm sàng (${maKhoa} - ${date})`,
                        actionType: 'DELETE_ALL',
                        filterSummary: `ngay_thuc_hien=${date}, ma_khoa=${maKhoa}`,
                        recordsCount: existingRecords.length,
                        data: existingRecords,
                        user: auth.user,
                        restorable: false
                    });
                }

                await tx.clinicalScheduleRecord.deleteMany({
                    where: {
                        ngay_thuc_hien: date,
                        ma_khoa: maKhoa
                    }
                });
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

    } catch (error: unknown) {
        if (error instanceof SnapshotLimitError) {
            return NextResponse.json({ success: false, message: error.message }, { status: 400 });
        }
        console.error('Error deleting schedule:', error);
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ success: false, message: 'Database error: ' + msg }, { status: 500 });
    }
}
