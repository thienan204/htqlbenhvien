import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';
import dayjs from 'dayjs';

export async function POST(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const body = await request.json();
        const {
            ma_khoa,
            monthYear, // 'YYYY-MM'
            overwrite = false
        } = body;

        if (!ma_khoa || !monthYear) {
            return NextResponse.json({ error: 'Thiếu mã khoa (ma_khoa) hoặc tháng năm (monthYear)' }, { status: 400 });
        }

        // Kiểm tra phân quyền: ADMIN, TCCB hoặc Lãnh đạo của khoa
        const isSuperAdmin = user.role === 'ADMIN' || user.userLevel === 'LEVEL_1_BGD';
        const isTCCB = user.role === 'TCCB' || (user.ma_khoa && ['TCCB', 'TC_CB', 'P02'].includes(user.ma_khoa.toUpperCase()));
        const isDeptLeader = user.ma_khoa === ma_khoa && (user.isManager || user.isDeptLeader || user.userLevel === 'LEVEL_2_LEADER');

        if (!isSuperAdmin && !isTCCB && !isDeptLeader) {
            return NextResponse.json({ error: 'Bạn không có quyền khởi tạo công cho khoa phòng này' }, { status: 403 });
        }

        // Kiểm tra khóa sổ tháng
        const lock = await prisma.staffMonthlyLock.findFirst({
            where: {
                ma_khoa,
                monthYear,
                sheetType: 'CHAM_CONG',
                isLocked: true
            }
        });

        if (lock) {
            return NextResponse.json({ error: `Tháng ${monthYear} đã bị khóa sổ bởi ${lock.lockedBy || 'Phòng TCCB'}. Không thể chỉnh sửa!` }, { status: 400 });
        }

        // Lấy danh sách nhân viên trong khoa
        const staffList = await prisma.staff.findMany({
            where: { ma_khoa },
            orderBy: { ho_ten: 'asc' }
        });

        if (staffList.length === 0) {
            return NextResponse.json({ error: 'Không tìm thấy nhân viên trong khoa phòng này' }, { status: 404 });
        }

        const [yearStr, monthStr] = monthYear.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const daysInMonth = dayjs(`${year}-${month}-01`).daysInMonth();

        // Ký hiệu công: CNTT dùng 'x', Lâm sàng/khoa khác dùng '+'
        const defaultCode = (ma_khoa === 'KP046') ? 'x' : '+';

        let createdCount = 0;
        const recordsToCreate: any[] = [];

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${yearStr}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayObj = dayjs(dateStr);
            const dayOfWeek = dayObj.day(); // 0: Chủ Nhật, 1: T2, ..., 6: T7

            // Chỉ điền công ngày làm việc bình thường: Thứ 2 đến Thứ 6 (1..5)
            const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
            if (!isWeekday) {
                continue;
            }

            for (const st of staffList) {
                // Kiểm tra xem đã có bản ghi công chưa
                const existing = await prisma.staffAttendanceRecord.findFirst({
                    where: {
                        staffId: st.id,
                        workDate: dateStr,
                        session: 'FULL_DAY'
                    }
                });

                if (!existing) {
                    recordsToCreate.push({
                        staffId: st.id,
                        ma_khoa,
                        workDate: dateStr,
                        code: defaultCode,
                        session: 'FULL_DAY',
                        value: 1.0,
                        updatedBy: user.id
                    });
                } else if (overwrite && ['X', '+'].includes(existing.code.trim().toUpperCase())) {
                    // Nếu overwrite, chỉ cập nhật lại nếu công cũ là x hoặc +
                    await prisma.staffAttendanceRecord.update({
                        where: { id: existing.id },
                        data: {
                            code: defaultCode,
                            value: 1.0,
                            updatedBy: user.id
                        }
                    });
                    createdCount++;
                }
            }
        }

        if (recordsToCreate.length > 0) {
            await prisma.staffAttendanceRecord.createMany({
                data: recordsToCreate
            });
            createdCount += recordsToCreate.length;
        }

        return NextResponse.json({
            success: true,
            message: `Đã khởi tạo thành công ${createdCount} công đi làm ngày thường (T2-T6) cho cả tháng ${monthStr}/${year}!`,
            createdCount,
            staffCount: staffList.length
        });
    } catch (error: any) {
        console.error('Error init month attendance:', error);
        return NextResponse.json({ error: error.message || 'Lỗi khi khởi tạo công tháng' }, { status: 500 });
    }
}
