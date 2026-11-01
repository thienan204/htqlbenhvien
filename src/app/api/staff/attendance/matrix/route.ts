import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';

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
        const ma_khoa = searchParams.get('ma_khoa') || (user.ma_khoa && user.ma_khoa !== 'KP046' && user.role !== 'ADMIN' ? user.ma_khoa : 'KP046');

        const [yearStr, monthStr] = monthYear.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);

        if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
            return NextResponse.json({ error: 'Tháng năm không hợp lệ (định dạng YYYY-MM)' }, { status: 400 });
        }

        // Tính số ngày trong tháng
        const daysInMonth = new Date(year, month, 0).getDate();
        const daysInfo: any[] = [];

        // Danh mục ngày lễ dương lịch cố định tại Việt Nam
        const solarHolidays: Record<string, string> = {
            '01-01': 'Tết Dương Lịch',
            '04-30': 'Chiến Thắng 30/4',
            '05-01': 'Quốc Tế Lao Động 1/5',
            '09-02': 'Quốc Khánh 2/9',
            '09-03': 'Nghỉ Lễ Quốc Khánh'
        };

        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month - 1, d);
            const dayOfWeek = dateObj.getDay(); // 0 = Chủ Nhật, 6 = Thứ Bảy
            const monthDayStr = `${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dateStr = `${year}-${monthDayStr}`;
            const holidayName = solarHolidays[monthDayStr] || null;
            daysInfo.push({
                day: d,
                dateStr,
                dayOfWeek,
                isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
                isSaturday: dayOfWeek === 6,
                isSunday: dayOfWeek === 0,
                isHoliday: Boolean(holidayName),
                holidayName
            });
        }

        // Lấy danh sách nhân sự của phòng ban
        const staffList = await prisma.staff.findMany({
            where: { ma_khoa },
            include: {
                chuc_vu_ref: true,
                chuc_danh_ref: true,
                bac_luong_ref: true,
                he_so_luong_ref: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        isAvailable: true,
                        autoAssignDisabled: true
                    }
                }
            },
            orderBy: [
                { ma_nv: 'asc' }
            ]
        });

        // Sắp xếp ưu tiên: Trưởng khoa/phòng, Phụ trách khoa -> Phó khoa/phòng -> Điều dưỡng trưởng -> Cán bộ
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

        const db = prisma as any;

        // Lấy tất cả bản ghi chấm công trong tháng
        const attendanceRecords = await db.staffAttendanceRecord.findMany({
            where: {
                staffId: { in: staffIds },
                workDate: {
                    gte: startDateStr,
                    lte: endDateStr
                }
            },
            include: {
                dutyRecord: {
                    select: {
                        id: true,
                        dutyDate: true,
                        dutyCode: true,
                        allowanceDays: true
                    }
                }
            }
        });

        // Lấy tất cả bản ghi chấm trực trong tháng
        const dutyRecords = await db.staffDutyRecord.findMany({
            where: {
                staffId: { in: staffIds },
                dutyDate: {
                    gte: startDateStr,
                    lte: endDateStr
                }
            }
        });

        // Lấy dữ liệu Chấm Thêm Giờ (Overtime)
        const overtimeRecords = await db.staffOvertimeRecord.findMany({
            where: {
                staffId: { in: staffIds },
                workDate: {
                    gte: startDateStr,
                    lte: endDateStr
                }
            }
        });

        // Lấy trạng thái khóa sổ tháng
        const monthlyLocks = await db.staffMonthlyLock.findMany({
            where: {
                ma_khoa,
                monthYear
            }
        });

        // Lấy ghi chú chấm công tháng của cán bộ
        const monthlyNotes = await db.staffMonthlyAttendanceNote.findMany({
            where: {
                staffId: { in: staffIds },
                monthYear
            }
        });
        const noteByStaff: Record<string, string> = {};
        monthlyNotes.forEach((mn: any) => {
            noteByStaff[mn.staffId] = mn.note;
        });

        // Đánh dấu thêm các ngày có chấm công Lễ (L/Te) hoặc trực Lễ (L/Te)
        attendanceRecords.forEach((att: any) => {
            const code = (att.code || '').trim().toUpperCase();
            if (code === 'L' || code === 'TE') {
                const dayNum = parseInt(att.workDate.split('-')[2], 10);
                const d = daysInfo.find(di => di.day === dayNum);
                if (d) {
                    d.isHoliday = true;
                    if (!d.holidayName) d.holidayName = code === 'TE' ? 'Tết' : 'Ngày Lễ';
                }
            }
        });
        dutyRecords.forEach((dr: any) => {
            const code = (dr.dutyCode || '').trim().toUpperCase();
            if (code === 'L' || code === 'TE') {
                const dayNum = parseInt(dr.dutyDate.split('-')[2], 10);
                const d = daysInfo.find(di => di.day === dayNum);
                if (d) {
                    d.isHoliday = true;
                    if (!d.holidayName) d.holidayName = code === 'TE' ? 'Trực Tết' : 'Trực Lễ';
                }
            }
        });

        const lockMap: Record<string, any> = {};
        monthlyLocks.forEach((l: any) => {
            lockMap[l.sheetType] = l;
        });

        // Tổ chức dữ liệu theo từng cán bộ
        const attendanceByStaffAndDay: Record<string, Record<number, any>> = {};
        const dutyByStaffAndDay: Record<string, Record<number, any>> = {};
        const overtimeByStaffAndDay: Record<string, Record<number, any>> = {};

        attendanceRecords.forEach((att: any) => {
            const dayNum = parseInt(att.workDate.split('-')[2], 10);
            if (!attendanceByStaffAndDay[att.staffId]) {
                attendanceByStaffAndDay[att.staffId] = {};
            }
            attendanceByStaffAndDay[att.staffId][dayNum] = att;
        });

        dutyRecords.forEach((d: any) => {
            const dayNum = parseInt(d.dutyDate.split('-')[2], 10);
            if (!dutyByStaffAndDay[d.staffId]) {
                dutyByStaffAndDay[d.staffId] = {};
            }
            dutyByStaffAndDay[d.staffId][dayNum] = d;
        });

        overtimeRecords.forEach((ot: any) => {
            const dayNum = parseInt(ot.workDate.split('-')[2], 10);
            if (!overtimeByStaffAndDay[ot.staffId]) {
                overtimeByStaffAndDay[ot.staffId] = {};
            }
            overtimeByStaffAndDay[ot.staffId][dayNum] = ot;
        });

        // Tổng kết từng nhân viên
        const staffData = staffList.map((st, index) => {
            const attMap = attendanceByStaffAndDay[st.id] || {};
            const dMap = dutyByStaffAndDay[st.id] || {};

            // Tính công:
            // - Lương thời gian: x (1.0), Nb (1.0 hoặc 0.5), Nb/x (1.0), x/Nb (1.0), P (1.0), L (1.0), H (1.0)
            // - Không lương: KL (1.0)
            // - BHXH: Ô (ốm), TS (thai sản)
            let luongThoiGian = 0;
            let nghiKhongLuong = 0;
            let huongBHXH = 0;

            for (let d = 1; d <= daysInMonth; d++) {
                const att = attMap[d];
                if (att) {
                    const c = (att.code || '').trim().toUpperCase();
                    const sec = (att.secondaryCode || '').trim().toUpperCase();

                    if (['X', '+', 'P', 'L', 'H'].includes(c)) {
                        luongThoiGian += (att.value ?? 1.0);
                    } else if (c === 'P/2') {
                        // Nghỉ phép 1/2 ngày: 0.5 công đi làm + 0.5 công nghỉ phép = 1.0 công thời gian
                        luongThoiGian += 1.0;
                    } else if (c === 'NB') {
                        // Nghỉ bù cả ngày hưởng nguyên lương thời gian
                        luongThoiGian += (att.value ?? 1.0);
                        if (sec === 'X' || sec === '+') {
                            luongThoiGian += 0.5; // Đã bao gồm cả buổi làm việc
                        }
                    } else if (c === 'NB/2') {
                        // Nghỉ bù 1/2 ngày: 0.5 công đi làm + 0.5 công nghỉ bù = 1.0 công thời gian
                        luongThoiGian += 1.0;
                    } else if (c === 'KL') {
                        nghiKhongLuong += (att.value ?? 1.0);
                    } else if (['Ô', 'O', 'TS'].includes(c)) {
                        huongBHXH += (att.value ?? 1.0);
                    }
                }
            }

            // Tính trực:
            // - Ngày thường: T
            // - T7, CN: C
            // - Lễ tết: L, Te
            let dutyNgayThuong = 0;
            let dutyT7CN = 0;
            let dutyLeTet = 0;
            let totalAllowanceDays = 0;
            let totalCompensatedDays = 0;

            for (let d = 1; d <= daysInMonth; d++) {
                const duty = dMap[d];
                if (duty) {
                    const code = (duty.dutyCode || '').trim().toUpperCase();
                    if (code === 'T') dutyNgayThuong += 1;
                    else if (code === 'C') dutyT7CN += 1;
                    else if (code === 'L' || code === 'TE') dutyLeTet += 1;

                    totalAllowanceDays += (duty.allowanceDays ?? 1.0);
                    totalCompensatedDays += (duty.compensatedDays ?? 0.0);
                }
            }

            const totalDuty = dutyNgayThuong + dutyT7CN + dutyLeTet;
            const remainingCompensatoryDays = Math.max(0, totalAllowanceDays - totalCompensatedDays);

            // Tính làm thêm giờ (Overtime):
            const otMap = overtimeByStaffAndDay[st.id] || {};
            let totalDayHours = 0;
            let totalNightHours = 0;
            for (let d = 1; d <= daysInMonth; d++) {
                const ot = otMap[d];
                if (ot) {
                    totalDayHours += (ot.dayHours || 0);
                    totalNightHours += (ot.nightHours || 0);
                }
            }
            const totalOvertimeHours = totalDayHours + totalNightHours;

            return {
                stt: index + 1,
                staffId: st.id,
                ma_nv: st.ma_nv,
                ho_ten: st.ho_ten,
                so_dien_thoai: st.so_dien_thoai,
                chuc_vu: st.chuc_vu_ref?.name || '',
                chuc_danh: st.chuc_danh_ref?.name || '',
                bac_luong: st.bac_luong_ref?.name || '',
                he_so_luong: st.he_so_luong_ref?.name || '',
                userId: st.user?.id || null,
                username: st.user?.username || null,
                isAvailable: st.user?.isAvailable ?? false,
                attendanceMap: attMap,
                dutyMap: dMap,
                overtimeMap: otMap,
                monthlyNote: noteByStaff[st.id] || '',
                attendanceSummary: {
                    luongThoiGian,
                    nghiKhongLuong,
                    huongBHXH,
                    tongCong: luongThoiGian + nghiKhongLuong + huongBHXH
                },
                dutySummary: {
                    ngayThuong: dutyNgayThuong,
                    t7cn: dutyT7CN,
                    leTet: dutyLeTet,
                    tongSo: totalDuty,
                    totalAllowanceDays,
                    totalCompensatedDays,
                    remainingCompensatoryDays
                },
                overtimeSummary: {
                    totalDayHours,
                    totalNightHours,
                    totalOvertimeHours
                }
            };
        });

        // Dòng CỘNG toàn phòng
        const totalDeptAttendance = {
            luongThoiGian: staffData.reduce((acc, cur) => acc + cur.attendanceSummary.luongThoiGian, 0),
            nghiKhongLuong: staffData.reduce((acc, cur) => acc + cur.attendanceSummary.nghiKhongLuong, 0),
            huongBHXH: staffData.reduce((acc, cur) => acc + cur.attendanceSummary.huongBHXH, 0),
        };

        const totalDeptDuty = {
            ngayThuong: staffData.reduce((acc, cur) => acc + cur.dutySummary.ngayThuong, 0),
            t7cn: staffData.reduce((acc, cur) => acc + cur.dutySummary.t7cn, 0),
            leTet: staffData.reduce((acc, cur) => acc + cur.dutySummary.leTet, 0),
            tongSo: staffData.reduce((acc, cur) => acc + cur.dutySummary.tongSo, 0),
        };

        const totalDeptOvertime = {
            totalDayHours: staffData.reduce((acc, cur) => acc + (cur.overtimeSummary?.totalDayHours || 0), 0),
            totalNightHours: staffData.reduce((acc, cur) => acc + (cur.overtimeSummary?.totalNightHours || 0), 0),
            totalOvertimeHours: staffData.reduce((acc, cur) => acc + (cur.overtimeSummary?.totalOvertimeHours || 0), 0),
        };

        // Lấy tên khoa phòng hiện tại
        const department = await prisma.department.findUnique({
            where: { ma_khoa },
            select: { ten_khoa: true, ma_khoa: true }
        });

        // Lấy danh sách toàn bộ các khoa phòng trong bệnh viện
        const allDepartments = await prisma.department.findMany({
            select: { ma_khoa: true, ten_khoa: true },
            orderBy: { ten_khoa: 'asc' }
        });

        return NextResponse.json({
            monthYear,
            year,
            month,
            ma_khoa,
            ten_khoa: department?.ten_khoa || ma_khoa,
            departments: allDepartments,
            daysInMonth,
            daysInfo,
            staffData,
            totalDeptAttendance,
            totalDeptDuty,
            totalDeptOvertime,
            lockMap
        });
    } catch (error: any) {
        console.error('Error in attendance matrix:', error);
        return NextResponse.json({ error: error.message || 'Lỗi máy chủ khi lấy bảng chấm công' }, { status: 500 });
    }
}
