import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const maKhoa = searchParams.get('maKhoa');

        if (!date) {
            return NextResponse.json({ success: false, message: 'Thiếu tham số date (YYYY-MM-DD)' }, { status: 400 });
        }

        // Lấy danh sách Khoa/Phòng để làm dropdown filter
        const departments = await prisma.department.findMany({
            select: { ma_khoa: true, ten_khoa: true },
            orderBy: { ten_khoa: 'asc' }
        });

        // Lấy danh sách trạng thái điểm danh từ SystemCategory
        const attendanceStatuses = await prisma.systemCategory.findMany({
            where: { type: 'ATTENDANCE_STATUS', isActive: true },
            orderBy: { order: 'asc' }
        });

        let staffList: any[] = [];
        if (maKhoa) {
            // Lấy danh sách nhân viên thuộc khoa kèm theo điểm danh của ngày cụ thể và gần nhất
            const rawStaff = await prisma.staff.findMany({
                where: { ma_khoa: maKhoa },
                include: {
                    trinh_do_ref: true,
                    chuc_danh_ref: true,
                    attendances: {
                        where: { workDate: { lte: date } },
                        orderBy: { workDate: 'desc' },
                        take: 1
                    }
                },
                orderBy: { ho_ten: 'asc' }
            });

            // Format lại dữ liệu cho Frontend dễ dùng
            staffList = rawStaff.map(staff => {
                const latestAttendance = staff.attendances[0];
                const isToday = latestAttendance?.workDate === date;

                return {
                    id: staff.id,
                    ma_nv: staff.ma_nv,
                    ho_ten: staff.ho_ten,
                    chuc_danh: staff.chuc_danh_ref?.code || staff.chuc_danh_ref?.type || '',
                    trinh_do: staff.trinh_do_ref?.code || staff.trinh_do_ref?.type || '',
                    statusId: isToday ? (latestAttendance?.statusId || null) : null,
                    is_thuc_hien_dvkt: latestAttendance ? latestAttendance.is_thuc_hien_dvkt : true,
                    attendanceId: isToday ? (latestAttendance?.id || null) : null
                };
            });
        }

        return NextResponse.json({
            success: true,
            departments,
            attendanceStatuses,
            staffList
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date, staffId, statusId, is_thuc_hien_dvkt } = body;

        if (!date || !staffId) {
            return NextResponse.json({ success: false, message: 'Dữ liệu không hợp lệ' }, { status: 400 });
        }

        const attendance = await prisma.staffAttendance.upsert({
            where: {
                staffId_workDate: {
                    staffId: staffId,
                    workDate: date
                }
            },
            update: {
                statusId: statusId !== undefined ? statusId : undefined,
                is_thuc_hien_dvkt: is_thuc_hien_dvkt !== undefined ? is_thuc_hien_dvkt : undefined
            },
            create: {
                staffId: staffId,
                workDate: date,
                statusId: statusId || null,
                is_thuc_hien_dvkt: is_thuc_hien_dvkt !== undefined ? is_thuc_hien_dvkt : true
            }
        });

        return NextResponse.json({ success: true, attendance });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
