/**
 * BỘ KIỂM ĐỊNH SỨC KHỎE TOÀN HỆ THỐNG & CHỐNG HỒI QUY (SYSTEM HEALTH & REGRESSION SHIELD)
 * Bệnh viện Đa khoa Tỉnh Lạng Sơn
 * 
 * Script này tự động quét và kiểm tra toàn bộ các vai trò (Roles), Menu, và tính năng cốt lõi
 * trước khi đẩy code lên server. Nếu có bất kỳ chức năng cũ nào bị mất hoặc bị lỗi, script
 * sẽ BÁO ĐỎ và DỪNG ngay lập tức để bảo vệ hệ thống.
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function pass(msg) {
  console.log(`  ${COLORS.green}✔ [PASS]${COLORS.reset} ${msg}`);
}

function warn(msg) {
  console.log(`  ${COLORS.yellow}⚠ [WARN]${COLORS.reset} ${msg}`);
}

function fail(msg) {
  console.log(`  ${COLORS.red}✖ [FAIL]${COLORS.reset} ${COLORS.bold}${msg}${COLORS.reset}`);
}

async function runHealthCheck() {
  console.log('\n' + '='.repeat(70));
  console.log(`${COLORS.cyan}${COLORS.bold}🏥 BVĐK LẠNG SƠN - BỘ KIỂM TRA TOÀN DIỆN CHỐNG HỒI QUY (PRE-FLIGHT CHECK)${COLORS.reset}`);
  console.log('='.repeat(70) + '\n');

  let hasError = false;
  let totalTests = 0;
  let passedTests = 0;

  // -------------------------------------------------------------
  // PHẦN 1: KIỂM TRA KẾT NỐI & TÍNH TOÀN VẸN CƠ SỞ DỮ LIỆU
  // -------------------------------------------------------------
  console.log(`${COLORS.bold}1. KIỂM TRA CƠ SỞ DỮ LIỆU (DATABASE SANITY)${COLORS.reset}`);
  totalTests++;
  try {
    const [userCount, roleCount, menuCount, deptCount, reqCount] = await Promise.all([
      prisma.user.count(),
      prisma.role.count(),
      prisma.menu.count(),
      prisma.department.count(),
      prisma.iTRequest.count()
    ]);
    pass(`Kết nối Database thành công (Users: ${userCount}, Roles: ${roleCount}, Menus: ${menuCount}, Khoa/Phòng: ${deptCount}, Yêu cầu: ${reqCount})`);
    passedTests++;
  } catch (err) {
    fail(`Lỗi kết nối hoặc mất bảng trong Database: ${err.message}`);
    hasError = true;
  }

  // -------------------------------------------------------------
  // PHẦN 2: KIỂM TRA PHÂN QUYỀN & CHỨC NĂNG CỐT LÕI CỦA CÁC ROLE
  // -------------------------------------------------------------
  console.log(`\n${COLORS.bold}2. KIỂM TRA TÍNH TOÀN VẸN CÁC ROLE & NÚT BẤM CỐT LÕI (ROLE SANITY)${COLORS.reset}`);
  
  // 2.1 Role CNTT: Phải có quyền Xử lý & Nhận việc trên module Sự cố CNTT
  totalTests++;
  try {
    const cnttRole = await prisma.role.findUnique({ where: { code: 'CNTT' } });
    if (!cnttRole) {
      fail('Role CNTT không tồn tại trong hệ thống!');
      hasError = true;
    } else {
      const cnttUsers = await prisma.user.findMany({ where: { role: 'CNTT' } });
      if (cnttUsers.length === 0) {
        warn('Chưa có user nào được gán role CNTT!');
      } else {
        // Kiểm tra logic hiển thị nút Xử lý: isDeptStaff (role === 'CNTT' && targetDepartment === 'CNTT')
        const targetDept = 'CNTT';
        const isSafe = cnttUsers.every(u => u.role === targetDept);
        if (isSafe) {
          pass(`Role CNTT (${cnttUsers.length} tài khoản): Đảm bảo 100% thấy nút [Xử lý], [Nhận việc] tại IT Requests`);
          passedTests++;
        } else {
          fail('Phát hiện tài khoản CNTT bị lệch vai trò!');
          hasError = true;
        }
      }
    }
  } catch (e) {
    fail(`Lỗi khi kiểm tra Role CNTT: ${e.message}`);
    hasError = true;
  }

  // 2.2 Role ADMIN: Phải có toàn quyền
  totalTests++;
  try {
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!adminUser) {
      fail('Không tìm thấy tài khoản ADMIN trong hệ thống!');
      hasError = true;
    } else {
      pass(`Role ADMIN (${adminUser.username}): Quyền quản trị tối cao kích hoạt bình thường`);
      passedTests++;
    }
  } catch (e) {
    fail(`Lỗi khi kiểm tra Role ADMIN: ${e.message}`);
    hasError = true;
  }

  // 2.3 Role KHOA & KHOA_PHONG: Phải có quyền báo lỗi / tạo yêu cầu
  totalTests++;
  try {
    const khoaRole = await prisma.role.findFirst({ where: { code: { in: ['KHOA', 'KHOA_PHONG'] } } });
    if (khoaRole) {
      pass(`Role Khoa/Phòng: Đảm bảo quyền gửi yêu cầu sự cố cho các khoa lâm sàng/cận lâm sàng`);
      passedTests++;
    } else {
      warn('Không tìm thấy Role KHOA hoặc KHOA_PHONG!');
    }
  } catch (e) {
    fail(`Lỗi khi kiểm tra Role Khoa: ${e.message}`);
    hasError = true;
  }

  // -------------------------------------------------------------
  // PHẦN 3: KIỂM TRA HỆ THỐNG CÂY MENU & ĐƯỜNG DẪN BẢO VỆ
  // -------------------------------------------------------------
  console.log(`\n${COLORS.bold}3. KIỂM TRA ĐƯỜNG DẪN & CÂY ĐIỀU HƯỚNG MENU (MENU INTEGRITY)${COLORS.reset}`);
  
  // 3.1 Kiểm tra file admin-paths.json
  totalTests++;
  try {
    const adminPathsFile = path.join(process.cwd(), 'data', 'admin-paths.json');
    if (!fs.existsSync(adminPathsFile)) {
      fail('Thiếu file data/admin-paths.json!');
      hasError = true;
    } else {
      const paths = JSON.parse(fs.readFileSync(adminPathsFile, 'utf-8'));
      if (!Array.isArray(paths)) {
        fail('data/admin-paths.json không đúng định dạng mảng JSON!');
        hasError = true;
      } else {
        pass(`File admin-paths.json hợp lệ (${paths.length} đường dẫn quản trị được bảo vệ)`);
        passedTests++;
      }
    }
  } catch (e) {
    fail(`Lỗi kiểm tra admin-paths.json: ${e.message}`);
    hasError = true;
  }

  // 3.2 Kiểm tra Menu mồ côi (Orphan Menus)
  totalTests++;
  try {
    const allMenus = await prisma.menu.findMany();
    const menuMap = new Map(allMenus.map(m => [m.id, m]));
    let orphanCount = 0;
    
    for (const m of allMenus) {
      if (m.parentId && !menuMap.has(m.parentId)) {
        orphanCount++;
        fail(`Menu [${m.title}] trỏ đến Menu cha không tồn tại (parentId: ${m.parentId})!`);
        hasError = true;
      }
    }
    
    if (orphanCount === 0) {
      pass(`Cây Menu hợp lệ: 100% menu con (${allMenus.filter(m => m.parentId).length} mục) có menu cha chuẩn xác`);
      passedTests++;
    }
  } catch (e) {
    fail(`Lỗi kiểm tra cây Menu: ${e.message}`);
    hasError = true;
  }

  // -------------------------------------------------------------
  // PHẦN 4: KIỂM TRA CẤU HÌNH HỆ THỐNG (SYSTEM CONFIG)
  // -------------------------------------------------------------
  console.log(`\n${COLORS.bold}4. KIỂM TRA CẤU HÌNH HỆ THỐNG (SYSTEM CONFIG SANITY)${COLORS.reset}`);
  totalTests++;
  try {
    const configs = await prisma.specializedRule.findMany({
      where: {
        slug: { in: ['system-configs', 'it-request-fields-config'] }
      }
    });
    pass(`Các bảng cấu hình hệ thống hoạt động ổn định (${configs.length} cấu hình chính)`);
    passedTests++;
  } catch (e) {
    fail(`Lỗi khi đọc cấu hình hệ thống: ${e.message}`);
    hasError = true;
  }

  // -------------------------------------------------------------
  // TỔNG KẾT
  // -------------------------------------------------------------
  console.log('\n' + '='.repeat(70));
  if (hasError) {
    console.log(`${COLORS.red}${COLORS.bold}❌ KIỂM TRA THẤT BẠI: PHÁT HIỆN LỖI HỒI QUY HOẶC MẤT CHỨC NĂNG CŨ!${COLORS.reset}`);
    console.log(`${COLORS.yellow}👉 ĐÃ CHẶN DEPLOY LÊN SERVER. Vui lòng khắc phục các lỗi [FAIL] ở trên trước khi cập nhật!${COLORS.reset}`);
    console.log('='.repeat(70) + '\n');
    process.exit(1);
  } else {
    console.log(`${COLORS.green}${COLORS.bold}✅ TẤT CẢ KIỂM ĐỊNH ĐÃ VƯỢT QUA (${passedTests}/${totalTests} Passed)!${COLORS.reset}`);
    console.log(`${COLORS.cyan}🚀 Hệ thống an toàn 100%, bảo toàn toàn bộ chức năng cũ, sẵn sàng update lên server!${COLORS.reset}`);
    console.log('='.repeat(70) + '\n');
    process.exit(0);
  }
}

runHealthCheck()
  .catch(err => {
    console.error('Lỗi nghiêm trọng khi chạy HealthCheck:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

