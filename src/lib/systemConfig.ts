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
    tooltipOn?: string;
    tooltipOff?: string;
    helpText?: string;
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
        order: 1,
        tooltipOff: '⚪ Đang TẮT (Khởi tạo 1-chạm): Bấm nút "Khởi tạo công cả tháng" sẽ tự động điền ký hiệu làm việc mặc định toàn viện (+) ngay lập tức trong 1 click, không hỏi thêm.',
        tooltipOn: '🟢 Đang BẬT (Hỏi chọn ký hiệu): Bấm nút khởi tạo sẽ mở hộp thoại cho phép người quản lý chủ động chọn điền ký hiệu + (chuẩn Bộ Y tế) hoặc x (theo ca) cho toàn khoa phòng.'
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
        order: 2,
        helpText: '💡 Ký hiệu chấm công đi làm mặc định toàn viện khi chấm nhanh hoặc khởi tạo tự động. Dấu (+) là chuẩn Bộ Y tế, dấu (x) là đi làm theo ca.'
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
        order: 10,
        tooltipOff: '⚪ Đang TẮT (Gọn gàng sạch sẽ): Bảng danh bạ nhân sự mặc định chỉ hiển thị các cán bộ nhân viên đang công tác tại bệnh viện, ẩn hoàn toàn nhân sự đã thôi việc.',
        tooltipOn: '🟢 Đang BẬT (Hiển thị đầy đủ): Bảng danh bạ nhân sự hiển thị cả các nhân sự đã thôi việc / chấm dứt hợp đồng (có kèm Tag đỏ cảnh báo "Đã nghỉ việc").'
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
        order: 1,
        helpText: '💡 Số ngày trong tháng tiếp theo mà hệ thống tự động khóa sổ chấm công toàn viện (Ví dụ đặt là 5 thì đúng ngày mùng 5 hàng tháng sẽ chốt dữ liệu, không cho sửa công tháng trước).'
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
        order: 2,
        tooltipOff: '⚪ Đang TẮT (Hoạt động bình thường): Hệ thống mở cửa phục vụ toàn thể cán bộ, y bác sĩ và nhân viên bệnh viện đăng nhập và làm việc bình thường.',
        tooltipOn: '🟢 Đang BẬT (Khóa bảo trì khẩn cấp): Toàn viện tạm ngừng truy cập, chỉ tài khoản Quản trị viên (ADMIN) mới có thể đăng nhập để bảo trì hệ thống và cơ sở dữ liệu.'
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
        order: 20,
        helpText: '💡 Mã khoa trong danh mục bệnh viện ứng với bộ phận tiếp nhận xử lý sự cố CNTT. Mặc định là KP046.'
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
        order: 21,
        helpText: '💡 Mã khoa trong danh mục bệnh viện ứng với bộ phận tiếp nhận yêu cầu Vật tư Y tế. Mặc định là KP038.'
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
        order: 22,
        helpText: '💡 Mã khoa trong danh mục bệnh viện ứng với bộ phận tiếp nhận yêu cầu Hành chính Quản trị. Mặc định là KP040.'
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
        order: 25,
        tooltipOff: '⚪ Đang TẮT (Hướng 1 - Chuẩn hóa theo Role): Lọc chuẩn 100% theo Role chuyên trách. Chỉ nhân sự có đúng Role (ví dụ CNTT) mới ở trong lịch trực. Nhân sự khoa phòng có Role khác (như bạn Trang - KHOA_PHONG) dứt khoát không bao giờ xuất hiện.',
        tooltipOn: '🟢 Đang BẬT (Hướng 2 - Tự động bổ sung): Tự động nhận diện và đưa Lãnh đạo Khoa/Phòng (Trưởng/Phó phòng) vào danh sách trực để nhân viên tiện chuyển việc, ngay cả khi tài khoản Lãnh đạo chưa đổi sang Role kỹ thuật.'
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

