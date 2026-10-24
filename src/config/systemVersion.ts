export interface SystemReleaseInfo {
    version: string;
    releaseDate: string;
    title: string;
    description: string;
    highlights: string[];
    author?: string;
}

export const SYSTEM_CONFIG = {
    version: 'v2.4.26',
    releaseDate: '24/10/2026',
    appName: 'Hệ thống Quản lý Bệnh viện ĐKLS',
    shortName: 'HTQLBV ĐKLS',
    hospitalName: 'Bệnh viện Đa khoa Lạng Sơn',
    department: 'Phòng Công nghệ Thông tin',
    supportHotline: '0205.3870.115 / Ext: 115',
    supportEmail: 'cntt.bvdklangson@gmail.com',
};

export const SYSTEM_CHANGELOG: SystemReleaseInfo[] = [
    {
        version: 'v2.4.26',
        releaseDate: '24/10/2026',
        title: 'Bổ sung Mã QR Code Động, Quản lý Thay đổi & Tài liệu SOP Bắt buộc',
        description: 'Nâng cấp toàn diện cơ chế nhận diện trang bằng mã QR, quản lý phiên bản minh bạch và quy trình thay đổi chức năng y tế.',
        highlights: [
            'Tích hợp tạo mã QR Code động cho từng trang & Trang chủ, tải ảnh PNG in dán decal khoa phòng.',
            'Phân loại rõ ràng 2 trạng thái vận hành: [Thử nghiệm (Beta)] và [Hoạt động chính thức] trên menu.',
            'Bắt buộc đính kèm Tài liệu & Hướng dẫn sử dụng chuẩn SOP khi tạo chức năng mới.',
            'Tự động ghi nhận Nhật ký thay đổi (Change Log) khi chức năng chính thức có cập nhật mới.',
            'Tự động sinh tài liệu chuẩn hóa bệnh viện thông minh khi tạo menu mới.'
        ],
        author: 'Phòng Công nghệ Thông tin'
    },
    {
        version: 'v2.3.10',
        releaseDate: '23/10/2026',
        title: 'Nâng cấp Trải nghiệm Báo lỗi CNTT & Tiện ích Lối tắt Desktop Khoa Phòng',
        description: 'Tối ưu hóa toàn diện giao diện Mobile, bộ lọc 2 hàng linh hoạt, chế độ Card View và tạo shortcut desktop một chạm.',
        highlights: [
            'Giao diện Ticket Báo lỗi CNTT chuẩn responsive cho cả điện thoại, máy tính bảng và desktop.',
            'Tiện ích tạo lối tắt Desktop thông minh cho máy tính tại các khoa phòng bệnh viện.',
            'Cơ chế bắt lỗi phiên đăng nhập hết hạn 401 tự động cảnh báo và lưu URL quay lại.',
            'Thanh lọc 2 hàng co giãn linh hoạt và nút gọi điện thoại trực tiếp cho kỹ thuật viên.'
        ],
        author: 'Phòng Công nghệ Thông tin'
    },
    {
        version: 'v2.0.0',
        releaseDate: '15/10/2026',
        title: 'Phát hành Nền tảng Quản trị Tập trung & Menu Builder Động',
        description: 'Xây dựng cấu trúc layout hiện đại, phân quyền linh hoạt theo vai trò và trung tâm giám sát hệ thống.',
        highlights: [
            'Menu Builder cho phép cấu hình phân cấp chức năng linh hoạt không cần sửa code.',
            'Hệ thống giám sát tài nguyên máy chủ CPU, RAM, Disk và giám sát API thời gian thực.',
            'Hỗ trợ chế độ chuyển đổi linh hoạt giữa Menu dọc và Menu ngang.'
        ],
        author: 'Phòng Công nghệ Thông tin'
    }
];
