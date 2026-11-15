import prisma from '@/lib/prisma';

export interface DayOffCheckResult {
    isWeekend: boolean;
    isHoliday: boolean;
    isDayOff: boolean;
    holidayName?: string | null;
}

export const SOLAR_HOLIDAYS: Record<string, string> = {
    '01-01': 'Tết Dương Lịch',
    '04-30': 'Chiến Thắng 30/4',
    '05-01': 'Quốc Tế Lao Động 1/5',
    '09-02': 'Quốc Khánh 2/9',
    '09-03': 'Nghỉ Lễ Quốc Khánh'
};

/**
 * Lấy cấu hình ngày lễ và ngày làm bù toàn viện từ specializedRule
 */
export async function getHospitalHolidayConfig(): Promise<{
    holidays: Array<{ date: string; name?: string }>;
    makeupWorkdays: Array<{ date: string; description?: string }>;
}> {
    try {
        const hospitalConfigRule = await prisma.specializedRule.findUnique({
            where: { slug: 'hospital-attendance-config' }
        });
        if (hospitalConfigRule?.logicConfig) {
            const logic: any = hospitalConfigRule.logicConfig;
            const holidays = Array.isArray(logic.holidays) ? logic.holidays : [];
            const makeupWorkdays = Array.isArray(logic.makeupWorkdays) ? logic.makeupWorkdays : [];
            return { holidays, makeupWorkdays };
        }
    } catch (e) {
        console.error('Lỗi đọc cấu hình hospital-attendance-config:', e);
    }
    return { holidays: [], makeupWorkdays: [] };
}

/**
 * Kiểm tra xem ngày cụ thể có phải là ngày nghỉ (Thứ 7, CN không làm bù hoặc Ngày Lễ/Tết)
 */
export function checkIsDayOff(
    dateStr: string,
    holidays: Array<{ date: string; name?: string }> = [],
    makeupWorkdays: Array<{ date: string; description?: string }> = []
): DayOffCheckResult {
    const [yStr, mStr, dStr] = dateStr.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    const day = parseInt(dStr, 10);
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay(); // 0 = CN, 6 = T7

    const monthDayStr = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const configuredHoliday = holidays.find(h => h.date === dateStr);
    const isSolarHoliday = Boolean(SOLAR_HOLIDAYS[monthDayStr]);
    const isHoliday = Boolean(configuredHoliday) || isSolarHoliday;
    const holidayName = configuredHoliday?.name || SOLAR_HOLIDAYS[monthDayStr] || null;

    const isMakeupWorkday = makeupWorkdays.some(m => m.date === dateStr);
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6) && !isMakeupWorkday;

    return {
        isWeekend,
        isHoliday,
        isDayOff: isWeekend || isHoliday,
        holidayName
    };
}

/**
 * Dọn dẹp bản ghi công đi làm tự sinh ('+', 'x') trên ngày nghỉ khi chấm trực
 */
export async function cleanSpuriousDayOffAttendance(staffId: string, dateStr: string): Promise<number> {
    try {
        const result = await prisma.staffAttendanceRecord.deleteMany({
            where: {
                staffId,
                workDate: dateStr,
                code: { in: ['+', 'x', 'X', '+/2', 'x/2', 'X/2'] },
                dutyRecordId: null
            }
        });
        return result.count;
    } catch (e) {
        console.error('Lỗi dọn dẹp công ngày nghỉ:', e);
        return 0;
    }
}

