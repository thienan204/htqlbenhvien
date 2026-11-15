import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';
import { decryptField } from '@/lib/staffCrypto';
import { SOLAR_HOLIDAYS, getHospitalHolidayConfig } from '../attendanceHelper';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

export async function GET(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const todayStr = dayjs().format('YYYY-MM-DD');

        // Mặc định lấy từ Thứ 2 đến Chủ nhật của tuần hiện tại nếu không truyền
        let startDate = searchParams.get('startDate');
        let endDate = searchParams.get('endDate');

        if (!startDate || !endDate) {
            const currentMonday = dayjs().startOf('isoWeek').format('YYYY-MM-DD');
            const currentSunday = dayjs().endOf('isoWeek').format('YYYY-MM-DD');
            startDate = currentMonday;
            endDate = currentSunday;
        }

        const filterDept = searchParams.get('ma_khoa') || undefined;
        const onlyWithDuties = searchParams.get('onlyWithDuties') !== 'false'; // Mặc định là true

        // Lấy cấu hình ngày lễ và ngày làm bù
        const { holidays: configHolidays, makeupWorkdays: configMakeupWorkdays } = await getHospitalHolidayConfig();

        // Tạo danh sách 7 ngày trong tuần
        const weekDays: any[] = [];
        const startDayjs = dayjs(startDate);
        const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

        for (let i = 0; i < 7; i++) {
            const current = startDayjs.add(i, 'day');
            const dateStr = current.format('YYYY-MM-DD');
            const dayOfWeek = current.day(); // 0: CN, 1: T2, ..., 6: T7
            const monthDayStr = current.format('MM-DD');

            const configuredHoliday = configHolidays.find((h: any) => h.date === dateStr);
            const configuredMakeup = configMakeupWorkdays.find((m: any) => m.date === dateStr);
            const isHoliday = Boolean(configuredHoliday) || Boolean(SOLAR_HOLIDAYS[monthDayStr]);
            const isActualWeekend = (dayOfWeek === 0 || dayOfWeek === 6) && !configuredMakeup;

            weekDays.push({
                index: i,
                dateStr,
                formattedDate: current.format('DD/MM'),
                dayOfWeek,
                dayName: dayNames[dayOfWeek],
                fullLabel: `${dayNames[dayOfWeek]} (${current.format('DD/MM')})`,
                isToday: dateStr === todayStr,
                isWeekend: isActualWeekend,
                isHoliday,
                holidayName: configuredHoliday?.name || SOLAR_HOLIDAYS[monthDayStr] || null
            });
        }

        // Lấy danh sách các Khoa/Phòng
        const whereDept: any = {};
        if (filterDept && filterDept !== 'ALL') {
            whereDept.ma_khoa = filterDept;
        }

        const allDepartments = await prisma.department.findMany({
            where: whereDept,
            select: {
                ma_khoa: true,
                ten_khoa: true
            },
            orderBy: {
                ma_khoa: 'asc'
            }
        });

        // Lấy tất cả các ca trực trong khoảng thời gian này
        const whereDuties: any = {
            dutyDate: {
                gte: startDate,
                lte: endDate
            }
        };
        if (filterDept && filterDept !== 'ALL') {
            whereDuties.ma_khoa = filterDept;
        }

        const dutyRecords = await prisma.staffDutyRecord.findMany({
            where: whereDuties,
            include: {
                staff: {
                    select: {
                        id: true,
                        ho_ten: true,
                        so_dien_thoai: true,
                        chuc_vu_ref: { select: { name: true } },
                        chuc_danh_ref: { select: { name: true } },
                        trinh_do_ref: { select: { name: true } }
                    }
                }
            },
            orderBy: [
                { dutyDate: 'asc' },
                { createdAt: 'asc' }
            ]
        });

        // Gom nhóm ca trực theo khoa và theo ngày
        // Cấu trúc: dutyMap[ma_khoa][dateStr] = { trucChinh: [], trucKem: [], thuongTru: [] }
        const dutyByDeptAndDate: Record<string, Record<string, {
            trucChinh: any[];
            trucKem: any[];
            thuongTru: any[];
        }>> = {};

        const deptDutyCount: Record<string, number> = {};

        dutyRecords.forEach(record => {
            const deptCode = record.ma_khoa;
            const dateStr = record.dutyDate;

            if (!dutyByDeptAndDate[deptCode]) {
                dutyByDeptAndDate[deptCode] = {};
            }
            if (!dutyByDeptAndDate[deptCode][dateStr]) {
                dutyByDeptAndDate[deptCode][dateStr] = {
                    trucChinh: [],
                    trucKem: [],
                    thuongTru: []
                };
            }

            deptDutyCount[deptCode] = (deptDutyCount[deptCode] || 0) + 1;

            const rawPhone = record.staff?.so_dien_thoai || '';
            const plainPhone = rawPhone.startsWith('enc:')
                ? (decryptField(rawPhone) || '')
                : rawPhone;

            const staffInfo = {
                id: record.staff?.id || record.staffId,
                dutyRecordId: record.id,
                ho_ten: record.staff?.ho_ten || 'Cán bộ',
                so_dien_thoai: plainPhone,
                chuc_vu: record.staff?.chuc_vu_ref?.name || '',
                chuc_danh: record.staff?.chuc_danh_ref?.name || '',
                trinh_do: record.staff?.trinh_do_ref?.name || '',
                dutyCode: record.dutyCode,
                dutyType: record.dutyType,
                allowanceDays: record.allowanceDays,
                note: record.note
            };

            const codeUpper = (record.dutyCode || '').trim().toUpperCase();
            const typeUpper = (record.dutyType || '').trim().toUpperCase();

            if (typeUpper === 'TRUC_KEM' || codeUpper === 'TK') {
                dutyByDeptAndDate[deptCode][dateStr].trucKem.push(staffInfo);
            } else if (typeUpper === 'TRUC_THUONG_TRU' || codeUpper === 'TT') {
                dutyByDeptAndDate[deptCode][dateStr].thuongTru.push(staffInfo);
            } else {
                // Mặc định là trực thường quy / trực chính
                dutyByDeptAndDate[deptCode][dateStr].trucChinh.push(staffInfo);
            }
        });

        // Lọc các khoa/phòng:
        // YÊU CẦU: "Chỉ hiển thị khoa phòng nào có lịch trực, không hiển thị lên hết"
        let filteredDepartments = allDepartments;
        if (onlyWithDuties) {
            filteredDepartments = allDepartments.filter(dept => (deptDutyCount[dept.ma_khoa] || 0) > 0);
        }

        // Tạo cấu trúc dữ liệu trả về cho từng khoa
        const departmentSchedules = filteredDepartments.map((dept, index) => {
            const deptSchedule = dutyByDeptAndDate[dept.ma_khoa] || {};
            const scheduleMap: Record<string, any> = {};

            weekDays.forEach(d => {
                scheduleMap[d.dateStr] = deptSchedule[d.dateStr] || {
                    trucChinh: [],
                    trucKem: [],
                    thuongTru: []
                };
            });

            return {
                stt: index + 1,
                ma_khoa: dept.ma_khoa,
                ten_khoa: dept.ten_khoa,
                totalDuties: deptDutyCount[dept.ma_khoa] || 0,
                schedule: scheduleMap
            };
        });

        return NextResponse.json({
            success: true,
            startDate,
            endDate,
            todayStr,
            weekDays,
            totalDuties: dutyRecords.length,
            totalDepartmentsWithDuties: departmentSchedules.length,
            totalAllDepartments: allDepartments.length,
            departments: departmentSchedules
        });

    } catch (error: any) {
        console.error('Lỗi lấy lịch trực kế hoạch:', error);
        return NextResponse.json({ error: error.message || 'Lỗi server nội bộ' }, { status: 500 });
    }
}

