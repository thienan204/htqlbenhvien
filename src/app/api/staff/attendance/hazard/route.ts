import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';
import { checkStaffAttendanceEligibility } from '@/lib/attendanceStaffFilter';
import { SOLAR_HOLIDAYS, getHospitalHolidayConfig } from '../attendanceHelper';

export async function GET(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
        const defaultMonthYear = `${currentYear}-${currentMonth}`;

        const monthYear = searchParams.get('monthYear') || defaultMonthYear;

        const isSuperAdmin = user.role === 'ADMIN';
        const isTCCB = user.role === 'TCCB' || (user.ma_khoa && ['TCCB', 'TC_CB', 'P02'].includes(user.ma_khoa.toUpperCase()));
        const isDirector = user.userLevel === 'LEVEL_1_BGD' || user.isDirector;
        const isDeptLeader = Boolean(
            user.userLevel === 'LEVEL_2_LEADER' || 
            user.isDeptLeader || 
            user.isManager
        );
        const isLeader = isSuperAdmin || isTCCB || isDirector || isDeptLeader;

        let ma_khoa = searchParams.get('ma_khoa');
        if (!isSuperAdmin && !isTCCB && !isDirector) {
            ma_khoa = user.ma_khoa || ma_khoa || 'KP046';
        } else {
            ma_khoa = ma_khoa || user.ma_khoa || 'KP046';
        }

        const [yearStr, monthStr] = monthYear.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);

        if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
            return NextResponse.json({ error: 'Tháng năm không hợp lệ (định dạng YYYY-MM)' }, { status: 400 });
        }

        const daysInMonth = new Date(year, month, 0).getDate();
        const daysInfo: any[] = [];

        // Lấy cấu hình ngày Lễ & Ngày làm bù toàn viện
        const { holidays: configHolidays, makeupWorkdays: configMakeupWorkdays } = await getHospitalHolidayConfig();

        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month - 1, d);
            const dayOfWeek = dateObj.getDay();
            const monthDayStr = `${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dateStr = `${year}-${monthDayStr}`;

            const configuredHoliday = configHolidays.find((h: any) => h.date === dateStr);
            const configuredMakeup = configMakeupWorkdays.find((m: any) => m.date === dateStr);
            const isConfiguredHoliday = Boolean(configuredHoliday);
            const isConfiguredMakeup = Boolean(configuredMakeup);

            const holidayName = configuredHoliday?.name || SOLAR_HOLIDAYS[monthDayStr] || null;
            const isHoliday = isConfiguredHoliday || Boolean(SOLAR_HOLIDAYS[monthDayStr]);
            const isActualWeekend = (dayOfWeek === 0 || dayOfWeek === 6) && !isConfiguredMakeup;

            daysInfo.push({
                day: d,
                dateStr,
                dayOfWeek,
                isWeekend: isActualWeekend,
                isSaturday: dayOfWeek === 6,
                isSunday: dayOfWeek === 0,
                isHoliday,
                holidayName,
                isMakeupWorkday: isConfiguredMakeup,
                makeupDescription: configuredMakeup?.description || null
            });
        }

        // Lấy danh sách nhân sự của khoa phòng
        const rawStaffList = await prisma.staff.findMany({
            where: { ma_khoa },
            include: {
                chuc_vu_ref: true,
                chuc_danh_ref: true,
                bac_luong_ref: true,
                he_so_luong_ref: true,
                trang_thai_ref: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        isAvailable: true
                    }
                }
            },
            orderBy: [{ ma_nv: 'asc' }]
        });

        let staffList = rawStaffList;
        if (!isLeader) {
            staffList = rawStaffList.filter(s => 
                s.id === user.staffId || 
                (user.ma_nv && s.ma_nv === user.ma_nv) || 
                (user.cccd && s.cccd === user.cccd) || 
                s.user?.id === user.id ||
                s.ma_nv === user.username
            );
        }

        // Sắp xếp ưu tiên chức vụ
        staffList.sort((a, b) => {
            const getRank = (st: any) => {
                const cv = (st.chuc_vu_ref?.name || '').toLowerCase();
                if (cv.includes('trưởng phòng') || cv.includes('trưởng khoa') || cv.includes('phụ trách')) return 1;
                if (cv.includes('phó')) return 2;
                if (cv.includes('điều dưỡng trưởng') || cv.includes('kỹ thuật viên trưởng')) return 3;
                if (st.ho_ten.includes('Biên') || st.ho_ten.includes('Hướng')) return 1;
                return 4;
            };
            return getRank(a) - getRank(b);
        });

        const staffIds = staffList.map(s => s.id);
        const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

        // Lấy bản ghi chấm độc hại
        const hazardRecords = await prisma.staffHazardRecord.findMany({
            where: {
                staffId: { in: staffIds },
                workDate: {
                    gte: startDateStr,
                    lte: endDateStr
                }
            }
        });

        // Lấy bản ghi chấm công hành chính để hỗ trợ tham chiếu (nếu cần hiển thị gợi ý)
        const attendanceRecords = await prisma.staffAttendanceRecord.findMany({
            where: {
                staffId: { in: staffIds },
                workDate: {
                    gte: startDateStr,
                    lte: endDateStr
                }
            },
            select: {
                staffId: true,
                workDate: true,
                code: true,
                session: true
            }
        });

        // Lấy trạng thái khóa sổ tháng
        const monthlyLock = await prisma.staffMonthlyLock.findFirst({
            where: {
                ma_khoa,
                monthYear,
                sheetType: 'CHAM_DOC_HAI'
            }
        });

        const hazardByStaffAndDay: Record<string, Record<number, any>> = {};
        hazardRecords.forEach(h => {
            const dayNum = parseInt(h.workDate.split('-')[2], 10);
            if (!hazardByStaffAndDay[h.staffId]) {
                hazardByStaffAndDay[h.staffId] = {};
            }
            hazardByStaffAndDay[h.staffId][dayNum] = h;
        });

        const attendanceByStaffAndDay: Record<string, Record<number, any>> = {};
        attendanceRecords.forEach(att => {
            const dayNum = parseInt(att.workDate.split('-')[2], 10);
            if (!attendanceByStaffAndDay[att.staffId]) {
                attendanceByStaffAndDay[att.staffId] = {};
            }
            attendanceByStaffAndDay[att.staffId][dayNum] = att;
        });

        // Lọc nhân sự theo quy tắc nghỉ việc/chuyển công tác
        const eligibleStaffList = staffList.filter(st => {
            const hasRecord = Boolean(hazardByStaffAndDay[st.id] && Object.keys(hazardByStaffAndDay[st.id]).length > 0);
            const filterInfo = checkStaffAttendanceEligibility(st, year, month, hasRecord);
            return filterInfo.shouldInclude;
        });

        let grandTotalDays = 0;
        let grandTotalAmount = 0;
        let grandTotalM1 = 0;
        let grandTotalM2 = 0;
        let grandTotalM3 = 0;
        let grandTotalM4 = 0;

        const staffData = eligibleStaffList.map((st, index) => {
            const hMap = hazardByStaffAndDay[st.id] || {};
            const attMap = attendanceByStaffAndDay[st.id] || {};

            let totalDays = 0;
            let m1Days = 0; // Mức 1: 13.000
            let m2Days = 0; // Mức 2: 20.000
            let m3Days = 0; // Mức 3: 26.000
            let m4Days = 0; // Mức 4: 32.000
            let totalAmount = 0;

            for (let d = 1; d <= daysInMonth; d++) {
                const rec = hMap[d];
                if (rec) {
                    const val = rec.value ?? (rec.code === 'I' ? 0.5 : 1.0);
                    const rate = rec.allowanceRate ?? 20000;
                    const level = rec.hazardLevel ?? 2;

                    totalDays += val;
                    if (level === 1 || rate === 13000) m1Days += val;
                    else if (level === 3 || rate === 26000) m3Days += val;
                    else if (level === 4 || rate === 32000) m4Days += val;
                    else m2Days += val; // Mặc định mức 2 (20.000)

                    totalAmount += val * rate;
                }
            }

            grandTotalDays += totalDays;
            grandTotalAmount += totalAmount;
            grandTotalM1 += m1Days;
            grandTotalM2 += m2Days;
            grandTotalM3 += m3Days;
            grandTotalM4 += m4Days;

            return {
                stt: index + 1,
                staffId: st.id,
                ma_nv: st.ma_nv,
                ho_ten: st.ho_ten,
                chuc_vu: st.chuc_vu_ref?.name || '',
                chuc_danh: st.chuc_danh_ref?.name || '',
                hazardMap: hMap,
                attendanceMap: attMap,
                summary: {
                    totalDays,
                    m1Days,
                    m2Days,
                    m3Days,
                    m4Days,
                    totalAmount
                }
            };
        });

        // Lấy thông tin khoa phòng
        const dept = await prisma.department.findUnique({
            where: { ma_khoa },
            select: { ma_khoa: true, ten_khoa: true }
        });

        return NextResponse.json({
            success: true,
            monthYear,
            ma_khoa,
            departmentName: dept?.ten_khoa || ma_khoa,
            daysInMonth,
            daysInfo,
            staffData,
            grandSummary: {
                totalStaff: staffData.length,
                totalDays: grandTotalDays,
                m1Days: grandTotalM1,
                m2Days: grandTotalM2,
                m3Days: grandTotalM3,
                m4Days: grandTotalM4,
                totalAmount: grandTotalAmount
            },
            isLocked: Boolean(monthlyLock?.isLocked),
            lockedInfo: monthlyLock
        });

    } catch (error: any) {
        console.error('Lỗi lấy ma trận chấm độc hại:', error);
        return NextResponse.json({ error: error.message || 'Lỗi server nội bộ' }, { status: 500 });
    }
}

