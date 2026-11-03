import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';

const CONFIG_SLUG = 'hospital-attendance-config';
const RULE_TYPE = 'SYSTEM_CONFIG';

const DEFAULT_HOLIDAYS = [
    { id: 'h_newyear', date: '2026-01-01', name: 'Tết Dương Lịch', allowanceDays: 2.0 },
    { id: 'h_reunification', date: '2026-04-30', name: 'Giải phóng Miền Nam 30/4', allowanceDays: 2.0 },
    { id: 'h_labor', date: '2026-05-01', name: 'Quốc Tế Lao Động 1/5', allowanceDays: 2.0 },
    { id: 'h_national_1', date: '2026-09-02', name: 'Quốc Khánh 2/9', allowanceDays: 2.0 },
    { id: 'h_national_2', date: '2026-09-03', name: 'Nghỉ Lễ Quốc Khánh', allowanceDays: 2.0 }
];

const DEFAULT_WORK_HOURS = {
    morningStart: '07:00',
    morningEnd: '11:30',
    afternoonStart: '13:30',
    afternoonEnd: '17:00',
    standardDailyHours: 8.0
};

const DEFAULT_CHECKIN_RULES = {
    checkInWindowMinutes: 60, // Cho phép bấm trước ca 60 phút
    lateToleranceMinutes: 15, // Dung sai trễ 15 phút (vẫn tính đúng giờ)
    cutOffMinutes: 90, // Tối đa 90 phút sau giờ vào (sau đó khóa tự bấm)
    earlyLeaveToleranceMinutes: 15, // Cho phép về sớm tối đa 15 phút
    checkOutWindowEndHour: '20:00', // Khung giờ chót bấm tan ca
    requireInternalNetwork: false, // Bắt buộc mạng nội bộ
    allowedSubnets: '', // Dải IP mạng nội bộ viện
    defaultMode: 'HYBRID' // HYBRID | WEB_ONLY | BIOMETRIC_ONLY | MANUAL
};

export async function GET(request: Request) {
    try {
        const [configRule, departments] = await Promise.all([
            prisma.specializedRule.findUnique({
                where: { slug: CONFIG_SLUG }
            }),
            prisma.department.findMany({
                select: { ma_khoa: true, ten_khoa: true, type: true },
                orderBy: { ten_khoa: 'asc' }
            })
        ]);

        if (!configRule || !configRule.logicConfig) {
            return NextResponse.json({
                success: true,
                config: {
                    holidays: DEFAULT_HOLIDAYS,
                    makeupWorkdays: [],
                    workHours: DEFAULT_WORK_HOURS,
                    checkInRules: DEFAULT_CHECKIN_RULES,
                    departmentConfigs: {}
                },
                departments
            });
        }

        const logic: any = configRule.logicConfig;

        return NextResponse.json({
            success: true,
            config: {
                holidays: Array.isArray(logic.holidays) ? logic.holidays : DEFAULT_HOLIDAYS,
                makeupWorkdays: Array.isArray(logic.makeupWorkdays) ? logic.makeupWorkdays : [],
                workHours: logic.workHours || DEFAULT_WORK_HOURS,
                checkInRules: { ...DEFAULT_CHECKIN_RULES, ...(logic.checkInRules || {}) },
                departmentConfigs: logic.departmentConfigs || {}
            },
            departments
        });
    } catch (error) {
        console.error('Lỗi lấy cấu hình chấm công bệnh viện:', error);
        return NextResponse.json({
            error: 'Đã xảy ra lỗi khi tải cấu hình chấm công toàn viện'
        }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        // Kiểm tra quyền hạn: Chỉ Admin hoặc Lãnh đạo cấp viện / TCCB mới có quyền sửa
        const isSuperAdmin = user.role === 'ADMIN' || user.userLevel === 'LEVEL_1_BGD';
        const isTCCB = user.role === 'TCCB' || (user.ma_khoa && ['TCCB', 'TC_CB', 'P02'].includes(user.ma_khoa.toUpperCase()));

        if (!isSuperAdmin && !isTCCB) {
            return NextResponse.json({
                error: 'Bạn không có quyền quản trị để thay đổi cấu hình toàn viện!'
            }, { status: 403 });
        }

        const body = await request.json();
        const { holidays, makeupWorkdays, workHours, checkInRules, departmentConfigs } = body;

        // Chuẩn hóa danh sách ngày nghỉ lễ
        const cleanHolidays = Array.isArray(holidays) ? holidays.map((h: any, idx: number) => ({
            id: h.id || `h_${Date.now()}_${idx}`,
            date: (h.date || '').trim(),
            name: (h.name || 'Ngày Lễ').trim(),
            allowanceDays: typeof h.allowanceDays === 'number' ? h.allowanceDays : 2.0
        })).filter((h: any) => /^\d{4}-\d{2}-\d{2}$/.test(h.date)) : DEFAULT_HOLIDAYS;

        // Chuẩn hóa danh sách ngày làm bù Thứ 7, CN
        const cleanMakeupWorkdays = Array.isArray(makeupWorkdays) ? makeupWorkdays.map((m: any, idx: number) => ({
            id: m.id || `m_${Date.now()}_${idx}`,
            date: (m.date || '').trim(),
            description: (m.description || 'Làm bù Thứ Bảy/Chủ Nhật').trim()
        })).filter((m: any) => /^\d{4}-\d{2}-\d{2}$/.test(m.date)) : [];

        // Khung giờ
        const cleanWorkHours = {
            morningStart: workHours?.morningStart || '07:00',
            morningEnd: workHours?.morningEnd || '11:30',
            afternoonStart: workHours?.afternoonStart || '13:30',
            afternoonEnd: workHours?.afternoonEnd || '17:00',
            standardDailyHours: Number(workHours?.standardDailyHours) || 8.0
        };

        // Quy tắc chấm công & dung sai
        const cleanCheckInRules = {
            checkInWindowMinutes: Number(checkInRules?.checkInWindowMinutes) || DEFAULT_CHECKIN_RULES.checkInWindowMinutes,
            lateToleranceMinutes: Number(checkInRules?.lateToleranceMinutes) || DEFAULT_CHECKIN_RULES.lateToleranceMinutes,
            cutOffMinutes: Number(checkInRules?.cutOffMinutes) || DEFAULT_CHECKIN_RULES.cutOffMinutes,
            earlyLeaveToleranceMinutes: Number(checkInRules?.earlyLeaveToleranceMinutes) || DEFAULT_CHECKIN_RULES.earlyLeaveToleranceMinutes,
            checkOutWindowEndHour: (checkInRules?.checkOutWindowEndHour || DEFAULT_CHECKIN_RULES.checkOutWindowEndHour).trim(),
            requireInternalNetwork: Boolean(checkInRules?.requireInternalNetwork),
            allowedSubnets: (checkInRules?.allowedSubnets || '').trim(),
            defaultMode: ['WEB_ONLY', 'BIOMETRIC_ONLY', 'HYBRID', 'MANUAL'].includes(checkInRules?.defaultMode) 
                ? checkInRules.defaultMode 
                : DEFAULT_CHECKIN_RULES.defaultMode
        };

        // Cấu hình theo Khoa / Phòng
        const cleanDepartmentConfigs = (departmentConfigs && typeof departmentConfigs === 'object') ? departmentConfigs : {};

        const newLogicConfig = {
            holidays: cleanHolidays,
            makeupWorkdays: cleanMakeupWorkdays,
            workHours: cleanWorkHours,
            checkInRules: cleanCheckInRules,
            departmentConfigs: cleanDepartmentConfigs,
            updatedAt: new Date().toISOString(),
            updatedBy: user.id
        };

        await prisma.specializedRule.upsert({
            where: { slug: CONFIG_SLUG },
            update: {
                name: 'Cấu hình Chấm công, Khung giờ & Ngày nghỉ Lễ Toàn Viện',
                ruleType: RULE_TYPE,
                logicConfig: newLogicConfig,
                isActive: true
            },
            create: {
                name: 'Cấu hình Chấm công, Khung giờ & Ngày nghỉ Lễ Toàn Viện',
                slug: CONFIG_SLUG,
                ruleType: RULE_TYPE,
                logicConfig: newLogicConfig,
                isActive: true,
                order: 1
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Đã lưu cấu hình chấm công & quy định khoa phòng toàn viện thành công!',
            config: newLogicConfig
        });
    } catch (error) {
        console.error('Lỗi lưu cấu hình chấm công toàn viện:', error);
        return NextResponse.json({
            error: 'Đã xảy ra lỗi khi lưu cấu hình toàn viện'
        }, { status: 500 });
    }
}

