const fs = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '..', 'src', 'app');
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'config');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'systemRoutes.json');

// Danh mục nhãn thân thiện cho các route đã biết
const KNOWN_LABELS = {
    '/': 'Trang chủ',
    '/xml-checker': 'Kiểm tra hồ sơ XML',
    '/xml1-viewer': 'Xem chi tiết XML1',
    '/xml1-report': 'Báo cáo tổng hợp XML1',
    '/xml-sua-ba': 'Sửa bệnh án XML',
    '/rules': 'Quy tắc XML',
    '/chuyen-de/ho-so-da-gui': 'Hồ sơ đã gửi BHYT',
    '/chuyen-de/kiem-tra-cchn': 'Kiểm tra CCHN',
    '/chuyen-de/doi-chieu-toan-vien': 'Đối chiếu toàn viện',
    '/chuyen-de/quy-tac-chuyen-de': 'Quy tắc chuyên đề',
    '/kiem-tra-chuyen-de': 'Kiểm tra chuyên đề',
    '/clinical-scheduling/schedule': 'Xếp lịch lâm sàng',
    '/clinical-scheduling/attendance': 'Chấm công lâm sàng',
    '/clinical-scheduling/saved-schedules': 'Lịch trực đã lưu',
    '/clinical-scheduling/config': 'Cấu hình ca trực & Excel',
    '/equipment-management/list': 'Danh sách thiết bị y tế',
    '/equipment-management/import-vouchers': 'Phiếu nhập thiết bị',
    '/equipment-management/export-vouchers': 'Phiếu xuất thiết bị',
    '/equipment-management/warehouses': 'Quản lý kho thiết bị',
    '/equipment-management/reports/inventory': 'Báo cáo tồn kho thiết bị',
    '/equipment-management/reports/import': 'Báo cáo nhập thiết bị',
    '/equipment-management/database-diagram': 'Sơ đồ cơ sở dữ liệu thiết bị',
    '/error-management/it-requests': 'Danh sách Yêu cầu IT',
    '/error-management/it-requests/create': 'Tạo Yêu Cầu IT',
    '/error-management/vendor-tasks': 'Việc gửi Đối tác ngoài',
    '/error-management/vtyt-requests': 'Danh sách Yêu cầu VTYT',
    '/error-management/vtyt-requests/create': 'Tạo Yêu Cầu VTYT',
    '/error-management/hcqt-requests': 'Danh sách Yêu cầu HCQT',
    '/error-management/hcqt-requests/create': 'Tạo Yêu Cầu HCQT',
    '/error-management/xml-errors': 'Lỗi XML',
    '/error-management/xml-summary': 'Tổng hợp lỗi XML',
    '/error-management/duty-roster': 'Lịch trực CNTT',
    '/error-management/images': 'Quản lý hình ảnh sự cố',
    '/error-management/report': 'Báo cáo sự cố',
    '/error-management/config': 'Cấu hình sự cố',
    '/doc-file-excel': 'Đọc dữ liệu Excel',
    '/doc-file-excel/duplicates': 'Kiểm tra trùng Excel',
    '/pttt-excel': 'Kiểm tra PTTT Excel',
    '/pttt-excel/duplicates': 'Kiểm tra trùng PTTT Excel',
    '/excel-rules': 'Quy tắc kiểm tra Excel',
    '/departments': 'Quản lý Khoa/Phòng',
    '/staff': 'Quản lý Nhân viên',
    '/staff/reports': 'Báo cáo nhân viên',
    '/users': 'Quản lý Tài khoản',
    '/roles': 'Quản lý Vai trò',
    '/system-categories': 'Danh mục hệ thống',
    '/icd10': 'Tra cứu danh mục ICD-10',
    '/bed-catalog': 'Danh mục giường bệnh',
    '/practicing-certificates': 'Chứng chỉ hành nghề',
    '/pham-vi-chuyen-mon': 'Phạm vi chuyên môn',
    '/tt32': 'Danh mục TT32',
    '/maintenance': 'Chế độ bảo trì',
    '/api-management': 'Quản lý API',
    '/admin/menus': 'Quản lý Menu',
    '/admin/instructions': 'Quản lý hướng dẫn',
    '/admin/notifications': 'Quản lý thông báo',
    '/admin/dashboard-cards': 'Cấu hình thẻ Dashboard',
    '/admin/paths-config': 'Cấu hình đường dẫn bảo vệ',
    '/bang-chi-tieu-3176': 'Bảng chỉ tiêu 3176',
    '/huong-dan': 'Hướng dẫn sử dụng',
    '/docs': 'Tài liệu hướng dẫn',
    '/login': 'Đăng nhập',
    '/pdf-reports': 'Báo cáo PDF',
    '/saved-reports': 'Báo cáo đã lưu',
    '/dynamic-forms': 'Quản lý biểu mẫu động',
    '/dynamic-forms/ksk-toan-dan/quan-ly': 'KSK Toàn dân - Quản lý hồ sơ',
    '/dynamic-forms/ksk-toan-dan/nhap-lieu': 'KSK Toàn dân - Nhập liệu',
    '/dynamic-forms/ksk-toan-dan/tra-cuu': 'KSK Toàn dân - Tra cứu'
};

function formatLabelFromPath(route) {
    if (KNOWN_LABELS[route]) {
        return `${route} (${KNOWN_LABELS[route]})`;
    }
    const parts = route.split('/').filter(Boolean);
    if (parts.length === 0) return '/ (Trang chủ)';
    const last = parts[parts.length - 1];
    const words = last.replace(/[_-]/g, ' ').split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    return `${route} (${words})`;
}

function scanPages(dir, baseDir = '') {
    let routes = [];
    if (!fs.existsSync(dir)) return routes;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(baseDir, entry.name);

        if (entry.isDirectory()) {
            routes = routes.concat(scanPages(fullPath, relPath));
        } else if (/^page\.(tsx|jsx|js)$/.test(entry.name)) {
            // Chuẩn hóa đường dẫn web
            let cleanRel = baseDir.replace(/\\/g, '/');
            // Xóa route groups như (modules), (auth)
            cleanRel = cleanRel.replace(/\/\([^)]+\)/g, '').replace(/^\([^)]+\)\/?/, '');
            
            let route = '/' + cleanRel;
            // Xóa dấu / thừa ở cuối
            route = route.replace(/\/+$/, '');
            if (route === '') route = '/';

            routes.push(route);
        }
    }
    return routes;
}

function run() {
    console.log('🔍 Đang quét toàn bộ các route trang (page.tsx) trong src/app...');
    const rawRoutes = scanPages(APP_DIR);
    const uniqueRoutes = Array.from(new Set(rawRoutes)).sort();

    const result = uniqueRoutes.map(route => ({
        value: route,
        label: formatLabelFromPath(route),
        title: KNOWN_LABELS[route] || route
    }));

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`✅ Đã quét thành công ${result.length} route tự động!`);
    console.log(`📁 Đã lưu danh sách tại: ${OUTPUT_FILE}`);
}

run();
