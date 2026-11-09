import prisma from '@/lib/prisma';

export interface SystemConfigDef {
    key: string;
    value: string;
    title: string;
    description: string;
    category: 'SYSTEM' | 'MODULE';
    module: string;
    route: string;
    dataType: 'BOOLEAN' | 'STRING' | 'NUMBER' | 'SELECT' | 'MULTI_SELECT' | 'JSON';
    options?: { label: string; value: string }[];
    defaultValue: string;
    order?: number;
}

// Danh mục các cấu hình được định nghĩa sẵn trong hệ thống
export const PREDEFINED_CONFIGS: SystemConfigDef[] = [
    // --- CẤU HÌNH PHÂN HỆ: CHẤM CÔNG (/staff/attendance) ---
    {
        key: 'ATTENDANCE_ALLOW_CHOOSE_SYMBOL_ON_INIT',
        value: 'false',
        title: 'Cho phép chọn ký hiệu khi Khởi Tạo Công Cả Tháng',
        description: 'Khi BẬT: Bấm khởi tạo công sẽ mở hộp thoại cho chọn dấu + hoặc x. Khi TẮT: Tự động điền ký hiệu mặc định trong 1 click.',
        category: 'MODULE',
        module: 'CHAM_CONG',
        route: '/staff/attendance',
        dataType: 'BOOLEAN',
        defaultValue: 'false',
        order: 1
    },
    {
        key: 'ATTENDANCE_DEFAULT_INIT_SYMBOL',
        value: '+',
        title: 'Ký hiệu chấm công đi làm mặc định toàn viện',
        description: 'Ký hiệu được dùng khi chấm nhanh hoặc khởi tạo công tự động.',
        category: 'MODULE',
        module: 'CHAM_CONG',
        route: '/staff/attendance',
        dataType: 'SELECT',
        options: [
            { label: 'Ký hiệu + (Chuẩn Bộ Y tế)', value: '+' },
            { label: 'Ký hiệu x (Đi làm)', value: 'x' }
        ],
        defaultValue: '+',
        order: 2
    },

    // --- CẤU HÌNH PHÂN HỆ: NHÂN SỰ (/staff) ---
    {
        key: 'STAFF_SHOW_RESIGNED_BY_DEFAULT',
        value: 'false',
        title: 'Hiển thị nhân viên đã nghỉ việc trên bảng danh bạ chính',
        description: 'Khi BẬT: Bảng nhân sự hiển thị cả nhân sự đã nghỉ việc (kèm tag đỏ cảnh báo). Khi TẮT: Mặc định chỉ hiện nhân sự đang làm việc.',
        category: 'MODULE',
        module: 'NHAN_SU',
        route: '/staff',
        dataType: 'BOOLEAN',
        defaultValue: 'false',
        order: 10
    },

    // --- CẤU HÌNH HỆ THỐNG / QUY TRÌNH TOÀN VIỆN ---
    {
        key: 'SYSTEM_MONTHLY_LOCK_DAY',
        value: '5',
        title: 'Ngày tự động khóa sổ chấm công hàng tháng',
        description: 'Ngày trong tháng kế tiếp mà hệ thống sẽ tự động khóa sổ chấm công toàn viện (Ví dụ: 5 nghĩa là ngày 05 hàng tháng sẽ chốt).',
        category: 'SYSTEM',
        module: 'QUY_TRINH_TOAN_VIEN',
        route: '/staff/attendance',
        dataType: 'NUMBER',
        defaultValue: '5',
        order: 1
    },
    {
        key: 'SYSTEM_MAINTENANCE_MODE',
        value: 'false',
        title: 'Chế độ bảo trì hệ thống toàn viện',
        description: 'Khi BẬT: Chỉ tài khoản Admin mới có thể đăng nhập và thao tác, các tài khoản khác sẽ nhận thông báo hệ thống đang bảo trì.',
        category: 'SYSTEM',
        module: 'BAO_MAT_HA_TANG',
        route: 'ALL',
        dataType: 'BOOLEAN',
        defaultValue: 'false',
        order: 2
    },

    // --- CẤU HÌNH PHÂN HỆ: QUẢN LÝ SỰ CỐ & YÊU CẦU HỖ TRỢ (/error-management) ---
    {
        key: 'TARGET_DEPT_MAPPING_CNTT',
        value: 'KP046',
        title: 'Mã khoa/phòng phụ trách: Công nghệ thông tin',
        description: 'Mã khoa trong danh mục Bệnh viện ứng với bộ phận tiếp nhận xử lý sự cố CNTT. Mặc định là KP046.',
        category: 'SYSTEM',
        module: 'XU_LY_SU_CO',
        route: '/error-management/it-requests',
        dataType: 'STRING',
        defaultValue: 'KP046',
        order: 20
    },
    {
        key: 'TARGET_DEPT_MAPPING_VTYT',
        value: 'KP038',
        title: 'Mã khoa/phòng phụ trách: Vật tư - Thiết bị Y tế',
        description: 'Mã khoa trong danh mục Bệnh viện ứng với bộ phận tiếp nhận yêu cầu VTYT. Mặc định là KP038.',
        category: 'SYSTEM',
        module: 'XU_LY_SU_CO',
        route: '/error-management/vtyt-requests',
        dataType: 'STRING',
        defaultValue: 'KP038',
        order: 21
    },
    {
        key: 'TARGET_DEPT_MAPPING_HCQT',
        value: 'KP040',
        title: 'Mã khoa/phòng phụ trách: Hành chính Quản trị',
        description: 'Mã khoa trong danh mục Bệnh viện ứng với bộ phận tiếp nhận yêu cầu HCQT. Mặc định là KP040.',
        category: 'SYSTEM',
        module: 'XU_LY_SU_CO',
        route: '/error-management/hcqt-requests',
        dataType: 'STRING',
        defaultValue: 'KP040',
        order: 22
    },
    {
        key: 'DUTY_ROSTER_INCLUDE_DEPT_LEADERS',
        value: 'false',
        title: 'Tự động bổ sung Lãnh đạo Khoa/Phòng vào danh sách trực & nhận việc',
        description: 'Khi TẮT (Mặc định - Hướng 1): Chỉ lấy đúng các nhân sự được phân quyền Role chuyên trách (ví dụ Role CNTT, VTYT, HCQT) vào lịch trực. Khi BẬT (Hướng 2): Tự động bổ sung thêm Lãnh đạo (Trưởng/Phó phòng) thuộc biên chế phòng ban vào danh sách trực dù tài khoản Lãnh đạo chưa đổi Role sang CNTT/VTYT/HCQT.',
        category: 'MODULE',
        module: 'XU_LY_SU_CO',
        route: '/error-management/duty-roster',
        dataType: 'BOOLEAN',
        defaultValue: 'false',
        order: 25
    }
];

/**
 * Đọc giá trị cấu hình an toàn từ Database (kèm cơ chế Fallback)
 */
export async function getSystemConfig(key: string, fallbackDefault?: string): Promise<string> {
    try {
        const item = await prisma.systemConfig.findUnique({
            where: { key }
        });
        if (item && item.value !== undefined && item.value !== null) {
            return item.value;
        }
        if (fallbackDefault !== undefined) return fallbackDefault;
        const predefined = PREDEFINED_CONFIGS.find(c => c.key === key);
        return predefined ? predefined.defaultValue : '';
    } catch (e) {
        console.error(`Lỗi đọc cấu hình [${key}]:`, e);
        if (fallbackDefault !== undefined) return fallbackDefault;
        const predefined = PREDEFINED_CONFIGS.find(c => c.key === key);
        return predefined ? predefined.defaultValue : '';
    }
}

/**
 * Kiểm tra cờ tính năng dạng Boolean (Bật/Tắt)
 */
export async function isSystemConfigEnabled(key: string, defaultVal: boolean = false): Promise<boolean> {
    const val = await getSystemConfig(key, defaultVal ? 'true' : 'false');
    return val === 'true' || val === '1';
}

