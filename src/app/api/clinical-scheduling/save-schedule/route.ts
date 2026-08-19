import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date, maKhoa, schedules } = body;

        if (!date || !maKhoa || !Array.isArray(schedules)) {
            return NextResponse.json({ success: false, message: 'Dữ liệu đầu vào không hợp lệ' }, { status: 400 });
        }

        // Bắt đầu một Transaction để đảm bảo tính toàn vẹn dữ liệu
        await prisma.$transaction(async (tx) => {
            // 1. Xóa toàn bộ lịch cũ của Khoa và Ngày này
            await tx.clinicalScheduleRecord.deleteMany({
                where: {
                    ngay_thuc_hien: date,
                    ma_khoa: maKhoa
                }
            });

            // 2. Chèn danh sách lịch mới
            if (schedules.length > 0) {
                const newRecords = schedules.map((item: any) => ({
                    so_phieu: item.so_phieu || item.SOPHIEU || '',
                    ma_ba: item.ma_ba || item.MAHOSOBENHAN || '',
                    ten_bn: item.ten_bn || item.TENBENHNHAN || '',
                    ma_dich_vu: String(item.ma_dich_vu || item.MADICHVU || ''),
                    ten_dich_vu: item.ten_dich_vu || item.TENDICHVU || '',
                    ma_khoa: maKhoa,
                    ngay_thuc_hien: date,
                    bat_dau: item.bat_dau || '',
                    ket_thuc: item.ket_thuc || '',
                    nguoi_thuc_hien: item.nguoi_thuc_hien || '',
                    ma_nv: item.ma_nv || '',
                    ma_may: item.ma_may || '',
                    ten_may: item.ten_may || ''
                }));

                await tx.clinicalScheduleRecord.createMany({
                    data: newRecords
                });
            }
        });

        return NextResponse.json({ success: true, message: 'Đã lưu lịch thành công' });
    } catch (error: any) {
        console.error('Error saving schedule:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
