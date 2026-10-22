/**
 * Module quản lý và tính toán 2 Khung thời gian: Giờ hành chính & Giờ trực cho Bệnh viện
 * Chuẩn hóa theo Múi giờ Việt Nam (Asia/Ho_Chi_Minh - GMT+7)
 */

export interface HospitalShiftConfig {
    morningStart?: string;      // Mặc định '07:00'
    morningEnd?: string;        // Mặc định '11:30'
    afternoonStart?: string;    // Mặc định '13:30'
    afternoonEnd?: string;      // Mặc định '16:50'
    holidays?: string[];        // Danh sách ngày nghỉ lễ YYYY-MM-DD
    makeupWorkdays?: string[];  // Danh sách ngày làm bù YYYY-MM-DD
}

export interface ShiftInfo {
    isOfficeHours: boolean;
    shiftType: 'OFFICE_MORNING' | 'OFFICE_AFTERNOON' | 'ON_CALL_NOON' | 'ON_CALL_NIGHT' | 'ON_CALL_WEEKEND';
    shiftName: string;
    startTime: Date; // Mốc thời gian bắt đầu của ca hiện tại để đếm việc
    dateStr: string;
    currentTimeStr: string;
}

export function parseTimeToMinutes(timeStr?: string, defaultMinutes = 0): number {
    if (!timeStr) return defaultMinutes;
    const parts = timeStr.trim().split(':');
    if (parts.length < 2) return defaultMinutes;
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
}

/**
 * Trích xuất thời gian chuẩn theo Giờ Việt Nam (GMT+7)
 */
export function getVietnamTimeParts(date: Date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';

    const year = parseInt(getPart('year'), 10);
    const month = parseInt(getPart('month'), 10);
    const day = parseInt(getPart('day'), 10);
    let hour = parseInt(getPart('hour'), 10);
    if (hour === 24) hour = 0;
    const minute = parseInt(getPart('minute'), 10);
    const second = parseInt(getPart('second'), 10);

    // Tính thứ trong tuần theo giờ Việt Nam (0: CN, 1: T2, ..., 6: T7)
    const vnDateObj = new Date(Date.UTC(year, month - 1, day, hour, minute));
    const dayOfWeek = vnDateObj.getUTCDay();

    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const timeMinutes = hour * 60 + minute;
    const currentTimeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    return { year, month, day, hour, minute, second, dayOfWeek, dateStr, timeMinutes, currentTimeStr };
}

/**
 * Tạo đối tượng Date (UTC) tương ứng với thời điểm giờ/phút tại Việt Nam
 */
export function createVnDate(year: number, month: number, day: number, hour: number, minute: number): Date {
    // Giờ VN là GMT+7 -> Giờ UTC = Giờ VN - 7
    return new Date(Date.UTC(year, month - 1, day, hour - 7, minute, 0, 0));
}

/**
 * Xác định chính xác Ca làm việc hiện tại và mốc bắt đầu tính tải công việc
 */
export function getCurrentHospitalShift(config?: HospitalShiftConfig, referenceDate: Date = new Date()): ShiftInfo {
    const vn = getVietnamTimeParts(referenceDate);

    const morningStartMin = parseTimeToMinutes(config?.morningStart, 7 * 60);       // 07:00
    const morningEndMin = parseTimeToMinutes(config?.morningEnd, 11 * 60 + 30);     // 11:30
    const afternoonStartMin = parseTimeToMinutes(config?.afternoonStart, 13 * 60 + 30); // 13:30
    const afternoonEndMin = parseTimeToMinutes(config?.afternoonEnd, 16 * 60 + 50); // 16:50 (Mặc định 16h50 giao ca)

    const holidays = config?.holidays || [];
    const makeupWorkdays = config?.makeupWorkdays || [];

    const isHoliday = holidays.includes(vn.dateStr);
    const isMakeupWorkday = makeupWorkdays.includes(vn.dateStr);
    const isStandardWorkday = vn.dayOfWeek >= 1 && vn.dayOfWeek <= 5; // T2 -> T6

    const isOfficeDay = (isStandardWorkday && !isHoliday) || isMakeupWorkday;

    // TRƯỜNG HỢP 1: NGÀY NGHỈ (Thứ 7, CN không làm bù hoặc Ngày lễ/Tết)
    if (!isOfficeDay) {
        // Mốc tính ca trực 24h tính từ giờ bắt đầu ca sáng ngày hôm nay (giờ VN)
        const startTime = createVnDate(vn.year, vn.month, vn.day, Math.floor(morningStartMin / 60), morningStartMin % 60);
        return {
            isOfficeHours: false,
            shiftType: 'ON_CALL_WEEKEND',
            shiftName: isHoliday ? 'Trực Ngày Lễ' : 'Trực Cuối Tuần (T7/CN)',
            startTime,
            dateStr: vn.dateStr,
            currentTimeStr: vn.currentTimeStr
        };
    }

    // TRƯỜNG HỢP 2: NGÀY HÀNH CHÍNH (Đã kiểm tra giờ)
    // 2.1. Ca Sáng Hành chính (07:00 -> 11:30)
    if (vn.timeMinutes >= morningStartMin && vn.timeMinutes < morningEndMin) {
        const startTime = createVnDate(vn.year, vn.month, vn.day, Math.floor(morningStartMin / 60), morningStartMin % 60);
        return {
            isOfficeHours: true,
            shiftType: 'OFFICE_MORNING',
            shiftName: 'Giờ Hành chính (Ca Sáng)',
            startTime,
            dateStr: vn.dateStr,
            currentTimeStr: vn.currentTimeStr
        };
    }

    // 2.2. Ca Trực Trưa (11:30 -> 13:30)
    if (vn.timeMinutes >= morningEndMin && vn.timeMinutes < afternoonStartMin) {
        const startTime = createVnDate(vn.year, vn.month, vn.day, Math.floor(morningEndMin / 60), morningEndMin % 60);
        return {
            isOfficeHours: false,
            shiftType: 'ON_CALL_NOON',
            shiftName: 'Giờ Trực (Ca Trưa)',
            startTime,
            dateStr: vn.dateStr,
            currentTimeStr: vn.currentTimeStr
        };
    }

    // 2.3. Ca Chiều Hành chính (13:30 -> 16:50/17:00)
    // Gộp cả ngày hành chính: Mốc tính tải tính từ 07:00 sáng hôm nay để không bị reset lúc 13h30
    if (vn.timeMinutes >= afternoonStartMin && vn.timeMinutes < afternoonEndMin) {
        const startTime = createVnDate(vn.year, vn.month, vn.day, Math.floor(morningStartMin / 60), morningStartMin % 60);
        return {
            isOfficeHours: true,
            shiftType: 'OFFICE_AFTERNOON',
            shiftName: 'Giờ Hành chính (Ca Chiều)',
            startTime,
            dateStr: vn.dateStr,
            currentTimeStr: vn.currentTimeStr
        };
    }

    // 2.4. Ca Trực Tối & Đêm: Từ 16:50 chiều hôm nay đến 23:59 đêm
    if (vn.timeMinutes >= afternoonEndMin) {
        // Mốc tính ca trực bắt đầu từ 16:50 chiều hôm nay
        const startTime = createVnDate(vn.year, vn.month, vn.day, Math.floor(afternoonEndMin / 60), afternoonEndMin % 60);
        return {
            isOfficeHours: false,
            shiftType: 'ON_CALL_NIGHT',
            shiftName: 'Giờ Trực (Tối & Đêm)',
            startTime,
            dateStr: vn.dateStr,
            currentTimeStr: vn.currentTimeStr
        };
    }

    // 2.5. Ca Trực Tối & Đêm: Từ 00:00 đến 06:59 sáng (Xuyên đêm từ chiều hôm trước)
    // Mốc bắt đầu phải là 16:50 chiều của NGÀY HÔM TRƯỚC (không ngắt ở 00h)
    const prevDayDate = new Date(referenceDate.getTime() - 24 * 60 * 60 * 1000);
    const prevVn = getVietnamTimeParts(prevDayDate);
    const startTime = createVnDate(prevVn.year, prevVn.month, prevVn.day, Math.floor(afternoonEndMin / 60), afternoonEndMin % 60);

    return {
        isOfficeHours: false,
        shiftType: 'ON_CALL_NIGHT',
        shiftName: 'Giờ Trực (Tối & Đêm)',
        startTime,
        dateStr: vn.dateStr,
        currentTimeStr: vn.currentTimeStr
    };
}
