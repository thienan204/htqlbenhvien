const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    console.log('=====================================================');
    console.log('🚀 BẮT ĐẦU CẬP NHẬT CẤU TRÚC MENU CHUẨN HÓA BỆNH VIỆN');
    console.log('=====================================================');

    // 1. Sao lưu danh sách menu hiện tại
    const currentMenus = await prisma.menu.findMany({ orderBy: { order: 'asc' } });
    const backupPath = path.join(__dirname, '../prisma/seeds/menus_backup_before_standardize.json');
    fs.writeFileSync(backupPath, JSON.stringify(currentMenus, null, 2), 'utf8');
    console.log(`📦 Đã sao lưu ${currentMenus.length} menu hiện tại vào: ${backupPath}`);

    // 2. Dọn dẹp dữ liệu bảng menu cũ
    await prisma.menu.deleteMany({});
    console.log('🧹 Đã dọn dẹp bảng Menu để nạp cấu trúc mới...');

    // 3. Định nghĩa Cấu trúc Menu Chuẩn Hóa
    const menuStructure = [
        // =========================================================================
        // PHẦN 1: MENU NGƯỜI DÙNG (KHOA PHÒNG & CHUYÊN MÔN) - isAdminOnly: false
        // =========================================================================
        {
            title: 'TỔNG QUAN',
            icon: 'DashboardOutlined',
            order: 10,
            isAdminOnly: false,
            children: [
                { title: 'Bàn làm việc (Trang chủ)', path: '/', icon: 'DashboardOutlined', order: 10 },
                { title: 'Thông báo toàn viện', path: '/admin/notifications', icon: 'BellOutlined', order: 20 },
                { title: 'Hòm thư & Góp ý khoa phòng', path: '/admin/feedbacks', icon: 'MailOutlined', order: 30 }
            ]
        },
        {
            title: 'YÊU CẦU KHOA PHÒNG',
            icon: 'ToolOutlined',
            order: 20,
            isAdminOnly: false,
            children: [
                { title: 'Yêu cầu hỗ trợ CNTT', path: '/error-management/it-requests', icon: 'DesktopOutlined', order: 10, permissionCode: 'MENU_ERROR_REQUESTS' },
                { title: 'Yêu cầu Vật tư y tế', path: '/error-management/vtyt-requests', icon: 'ToolOutlined', order: 20 },
                { title: 'Yêu cầu Hành chính - Quản trị', path: '/error-management/hcqt-requests', icon: 'BankOutlined', order: 30 },
                { title: 'Kho hình ảnh sự cố', path: '/error-management/images', icon: 'PictureOutlined', order: 40, permissionCode: 'MENU_IMAGE_MANAGEMENT' },
                { title: 'Báo cáo tổng hợp yêu cầu', path: '/error-management/report', icon: 'BarChartOutlined', order: 50, permissionCode: 'MENU_IT_REPORT' }
            ]
        },
        {
            title: 'GIÁM ĐỊNH & KIỂM TRA BHYT',
            icon: 'FileExcelOutlined',
            order: 30,
            isAdminOnly: false,
            children: [
                { title: 'Đọc & Kiểm tra file Excel', path: '/doc-file-excel', icon: 'FileExcelOutlined', order: 10, permissionCode: 'MENU_DOC_FILE_EXCEL' },
                { title: 'Đối chiếu dữ liệu toàn viện', path: '/chuyen-de/doi-chieu-toan-vien', icon: 'ReconciliationOutlined', order: 20 },
                { title: 'Kiểm tra Phẫu thuật - Thủ thuật', path: '/pttt-excel', icon: 'TableOutlined', order: 30 },
                { title: 'Kiểm tra Phạm vi & CCHN', path: '/chuyen-de/kiem-tra-cchn', icon: 'SafetyCertificateOutlined', order: 40 },
                { title: 'Tra cứu dữ liệu XML KCB', path: '/xml1-viewer', icon: 'FileTextOutlined', order: 50 },
                { title: 'Danh sách hồ sơ đã gửi', path: '/chuyen-de/ho-so-da-gui', icon: 'CheckSquareOutlined', order: 60 },
                { title: 'Danh mục Mẫu BHYT (01 - 06)', path: '/mau01-catalog', icon: 'AppstoreOutlined', order: 70 }
            ]
        },
        {
            title: 'VẬT TƯ & THIẾT BỊ',
            icon: 'ProjectOutlined',
            order: 40,
            isAdminOnly: false,
            children: [
                { title: 'Danh mục Kho khoa phòng', path: '/equipment-management/warehouses', icon: 'FolderOutlined', order: 10 },
                { title: 'Danh sách Thiết bị y tế', path: '/equipment-management/list', icon: 'ProjectOutlined', order: 20 },
                { title: 'Phiếu Xuất kho / Cấp phát', path: '/equipment-management/export-vouchers', icon: 'ExportOutlined', order: 30 },
                { title: 'Phiếu Nhập / Tiếp nhận', path: '/equipment-management/import-vouchers', icon: 'DownloadOutlined', order: 40 },
                { title: 'Báo cáo Xuất - Nhập - Tồn', path: '/equipment-management/reports/inventory', icon: 'BarChartOutlined', order: 50 }
            ]
        },
        {
            title: 'NHÂN SỰ & LỊCH TRỰC',
            icon: 'TeamOutlined',
            order: 50,
            isAdminOnly: false,
            children: [
                { title: 'Danh sách Nhân sự', path: '/staff', icon: 'TeamOutlined', order: 10 },
                { title: 'Quản lý Chứng chỉ hành nghề (CCHN)', path: '/practicing-certificates', icon: 'SafetyCertificateOutlined', order: 20 },
                { title: 'Lịch trực lâm sàng khoa phòng', path: '/clinical-scheduling/schedule', icon: 'CalendarOutlined', order: 30 },
                { title: 'Chấm công trực lâm sàng', path: '/clinical-scheduling/attendance', icon: 'CheckCircleOutlined', order: 40 }
            ]
        },
        {
            title: 'TRA CỨU & TIỆN ÍCH',
            icon: 'BookOutlined',
            order: 60,
            isAdminOnly: false,
            children: [
                { title: 'Tra cứu mã bệnh ICD-10', path: '/icd10', icon: 'SearchOutlined', order: 10 },
                { title: 'Danh mục Giường bệnh', path: '/bed-catalog', icon: 'ShopOutlined', order: 20 },
                { title: 'Bảng chỉ tiêu 3176', path: '/bang-chi-tieu-3176', icon: 'FileProtectOutlined', order: 30 },
                { title: 'Quản lý Khám sức khỏe', path: '/dynamic-forms/ksk-toan-dan/quan-ly', icon: 'HeartOutlined', order: 40 },
                { title: 'Sổ tay Quy trình & Hướng dẫn SOP', path: '/docs', icon: 'BookOutlined', order: 50 }
            ]
        },

        // =========================================================================
        // PHẦN 2: MENU QUẢN TRỊ (ADMIN & PHÒNG CNTT) - isAdminOnly: true
        // =========================================================================
        {
            title: 'TỔNG HỢP HỆ THỐNG',
            icon: 'DashboardOutlined',
            order: 100,
            isAdminOnly: true,
            children: [
                { title: 'Dashboard Quản trị', path: '/', icon: 'DashboardOutlined', order: 10, isAdminOnly: true },
                { title: 'Sơ đồ Kiến trúc & Luồng nghiệp vụ', path: '/he-thong/so-do-kien-truc', icon: 'BranchesOutlined', order: 20, isAdminOnly: true },
                { title: 'Cấu hình thông báo toàn viện', path: '/admin/notifications', icon: 'BellOutlined', order: 30, isAdminOnly: true }
            ]
        },
        {
            title: 'NGƯỜI DÙNG & PHÂN QUYỀN',
            icon: 'UserOutlined',
            order: 110,
            isAdminOnly: true,
            children: [
                { title: 'Quản lý Tài khoản (Users)', path: '/users', icon: 'UserOutlined', order: 10, isAdminOnly: true },
                { title: 'Quản lý Vai trò & Nhóm quyền (Roles)', path: '/roles', icon: 'LockOutlined', order: 20, isAdminOnly: true },
                { title: 'Điều phối Lịch trực & Phân việc CNTT', path: '/error-management/duty-roster', icon: 'TeamOutlined', order: 30, isAdminOnly: true, permissionCode: 'MENU_IT_DUTY' }
            ]
        },
        {
            title: 'QUẢN TRỊ DANH MỤC',
            icon: 'BarsOutlined',
            order: 120,
            isAdminOnly: true,
            children: [
                { title: 'Danh mục Hệ thống & Cấp bậc (Level)', path: '/system-categories', icon: 'BarsOutlined', order: 10, isAdminOnly: true },
                { title: 'Danh mục Khoa / Phòng', path: '/departments', icon: 'ApartmentOutlined', order: 20, isAdminOnly: true },
                { title: 'Danh mục Kỹ thuật TT32', path: '/tt32', icon: 'MedicineBoxOutlined', order: 30, isAdminOnly: true },
                { title: 'Quản lý Cổng kết nối API', path: '/api-management', icon: 'ApiOutlined', order: 40, isAdminOnly: true }
            ]
        },
        {
            title: 'CẤU HÌNH QUY TẮC BHYT',
            icon: 'CheckCircleOutlined',
            order: 130,
            isAdminOnly: true,
            children: [
                { title: 'Quy tắc kiểm tra XML', path: '/rules', icon: 'CheckCircleOutlined', order: 10, isAdminOnly: true },
                { title: 'Quy tắc kiểm tra file Excel', path: '/excel-rules', icon: 'FileExcelOutlined', order: 20, isAdminOnly: true },
                { title: 'Quy tắc giám định chuyên đề', path: '/chuyen-de/quy-tac-chuyen-de', icon: 'ExperimentOutlined', order: 30, isAdminOnly: true },
                { title: 'Quản lý XML Sửa Bệnh án', path: '/xml-sua-ba', icon: 'EditOutlined', order: 40, isAdminOnly: true }
            ]
        },
        {
            title: 'THIẾT KẾ & GIAO DIỆN',
            icon: 'AppstoreOutlined',
            order: 140,
            isAdminOnly: true,
            children: [
                { title: 'Quản lý Menu (Menu Builder)', path: '/admin/menus', icon: 'AppstoreOutlined', order: 10, isAdminOnly: true },
                { title: 'Thiết kế Dashboard (Dashboard Builder)', path: '/admin/dashboard-cards', icon: 'FundProjectionScreenOutlined', order: 20, isAdminOnly: true },
                { title: 'Quản lý Biểu mẫu động (Form Builder)', path: '/dynamic-forms', icon: 'FormOutlined', order: 30, isAdminOnly: true },
                { title: 'Quản lý Tài liệu & Hướng dẫn SOP', path: '/admin/instructions', icon: 'BookOutlined', order: 40, isAdminOnly: true }
            ]
        },
        {
            title: 'GIÁM SÁT & AN TOÀN',
            icon: 'DesktopOutlined',
            order: 150,
            isAdminOnly: true,
            children: [
                { title: 'Giám sát Tài nguyên (System Health)', path: '/admin/system-health', icon: 'DesktopOutlined', order: 10, isAdminOnly: true },
                { title: 'Cấu hình Bảo mật & Đường dẫn', path: '/admin/paths-config', icon: 'SecurityScanOutlined', order: 20, isAdminOnly: true },
                { title: 'Từ điển CSDL (Database Schema)', path: '/schema', icon: 'DatabaseOutlined', order: 30, isAdminOnly: true }
            ]
        }
    ];

    let totalParent = 0;
    let totalChildren = 0;

    for (const group of menuStructure) {
        const { children, ...parentData } = group;
        const createdParent = await prisma.menu.create({
            data: {
                ...parentData,
                path: null,
                status: 'OFFICIAL'
            }
        });
        totalParent++;

        if (children && children.length > 0) {
            for (const child of children) {
                await prisma.menu.create({
                    data: {
                        ...child,
                        parentId: createdParent.id,
                        status: 'OFFICIAL',
                        isAdminOnly: child.isAdminOnly !== undefined ? child.isAdminOnly : parentData.isAdminOnly
                    }
                });
                totalChildren++;
            }
        }
    }

    console.log(`✅ Đã tạo thành công: ${totalParent} Menu cha và ${totalChildren} Menu con!`);

    // 4. Đồng bộ danh sách mới ra file prisma/seeds/menus.json
    const newAllMenus = await prisma.menu.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
    const seedsPath = path.join(__dirname, '../prisma/seeds/menus.json');
    fs.writeFileSync(seedsPath, JSON.stringify(newAllMenus, null, 2), 'utf8');
    console.log(`📄 Đã cập nhật tệp seeds: ${seedsPath}`);
    console.log('=====================================================');
    console.log('🎉 HOÀN TẤT CHUẨN HÓA MENU HỆ THỐNG!');
    console.log('=====================================================');
}

main()
    .catch((e) => {
        console.error('❌ Lỗi khi cập nhật menu:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
