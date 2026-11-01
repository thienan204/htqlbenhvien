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
            staffId,
            ma_khoa = 'KP046',
            date, // 'YYYY-MM-DD'
            dayHours = 0,
            nightHours = 0,
            note = ''
        } = body;

        if (!staffId || !date) {
            return NextResponse.json({ error: 'Thiếu thông tin cán bộ hoặc ngày (staffId, date)' }, { status: 400 });
        }

        // 1. Kiểm tra khóa sổ tháng
        const monthYearStr = date.substring(0, 7);
        const lock = await prisma.staffMonthlyLock.findFirst({
            where: {
                ma_khoa,
                monthYear: monthYearStr,
                sheetType: 'CHAM_CONG',
                isLocked: true
            }
        });
        if (lock) {
            return NextResponse.json({
                error: `Bảng công tháng ${monthYearStr} của khoa này đã bị khóa sổ bởi ${lock.lockedBy || 'quản trị viên'}!`
            }, { status: 403 });
        }

        const parsedDayHours = Math.max(0, parseFloat(String(dayHours)) || 0);
        const parsedNightHours = Math.max(0, parseFloat(String(nightHours)) || 0);
        const total = parsedDayHours + parsedNightHours;

        // Nếu người dùng chọn xóa giờ làm thêm (tổng bằng 0)
        if (total === 0) {
            await prisma.staffOvertimeRecord.deleteMany({
                where: {
                    staffId,
                    workDate: date
                }
            });
            return NextResponse.json({
                success: true,
                message: `Đã xóa giờ làm thêm ngày ${date}`,
                totalHours: 0
            });
        }

        // 2. QUY TẮC RÀNG BUỘC 1: CÓ TRỰC THÌ KHÔNG ĐƯỢC CHẤM THÊM GIỜ
        const existingDuty = await prisma.staffDutyRecord.findUnique({
            where: {
                staffId_dutyDate: {
                    staffId,
                    dutyDate: date
                }
            }
        });

        if (existingDuty && existingDuty.dutyCode) {
            return NextResponse.json({
                error: `Cán bộ này đã có ca trực (${existingDuty.dutyCode}) vào ngày ${date}. Theo quy định bệnh viện, có lịch trực thì không được chấm thêm giờ!`
            }, { status: 400 });
        }

        // 3. QUY TẮC RÀNG BUỘC 2: SỐ GIỜ TỐI THIỂU 1 GIỜ / NGÀY
        if (total < 1) {
            return NextResponse.json({
                error: 'Số giờ làm thêm tối thiểu là 1 giờ/ngày!'
            }, { status: 400 });
        }

        // 4. QUY TẮC RÀNG BUỘC 3: GIỚI HẠN SỐ GIỜ THEO LOẠI NGÀY
        // - Ngày hành chính (T2 - T6): Tối đa 4 giờ/ngày
        // - Ngày nghỉ cuối tuần (T7, CN) và Lễ: Tối đa 12 giờ/ngày
        const dayOfWeek = dayjs(date).day(); // 0: CN, 6: T7
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const maxAllowed = isWeekend ? 12 : 4;

        if (total > maxAllowed) {
            return NextResponse.json({
                error: isWeekend
                    ? `Ngày nghỉ cuối tuần (${dayOfWeek === 0 ? 'Chủ Nhật' : 'Thứ 7'}) chỉ được làm thêm tối đa 12 giờ/ngày! (Bạn đang nhập ${total}h)`
                    : `Ngày hành chính (Thứ 2 - Thứ 6) chỉ được làm thêm tối đa 4 giờ/ngày! (Bạn đang nhập ${total}h)`
            }, { status: 400 });
        }

        // 5. CẬP NHẬT HOẶC TẠO MỚI BẢN GHI LÀM THÊM GIỜ
        const record = await prisma.staffOvertimeRecord.upsert({
            where: {
                staffId_workDate: {
                    staffId,
                    workDate: date
                }
            },
            update: {
                ma_khoa,
                dayHours: parsedDayHours,
                nightHours: parsedNightHours,
                totalHours: total,
                note: note || null,
                updatedBy: user.id
            },
            create: {
                staffId,
                ma_khoa,
                workDate: date,
                dayHours: parsedDayHours,
                nightHours: parsedNightHours,
                totalHours: total,
                note: note || null,
                createdBy: user.id,
                updatedBy: user.id
            }
        });

        return NextResponse.json({
            success: true,
            message: `Đã chấm ${total} giờ làm thêm ngày ${date} thành công`,
            record
        });
    } catch (error: any) {
        console.error('Error in overtime update-cell route:', error);
        return NextResponse.json({ error: error.message || 'Lỗi khi cập nhật giờ làm thêm' }, { status: 500 });
    }
}
