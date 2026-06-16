const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function importData(modelName, filename) {
    const filePath = path.join(__dirname, '../prisma/seeds', filename);
    if (!fs.existsSync(filePath)) {
        console.log(`Bỏ qua ${filename} vì không tìm thấy file.`);
        return;
    }

    const rawData = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(rawData);

    if (data.length === 0) {
        console.log(`Bỏ qua ${filename} vì file trống.`);
        return;
    }

    console.log(`Đang import ${data.length} bản ghi vào bảng ${modelName}...`);

    for (const item of data) {
        try {
            const whereClause = modelName === 'department' 
                ? { ma_khoa: item.ma_khoa }
                : { id: item.id };

            await prisma[modelName].upsert({
                where: whereClause,
                update: item,
                create: item
            });
        } catch (error) {
            console.error(`Lỗi khi import ${modelName}:`, error.message);
        }
    }
    console.log(`✅ Import xong ${modelName}.`);
}

async function main() {
    console.log('Bắt đầu import toàn bộ dữ liệu cấu hình và master data...');
    
    // Lưu ý: Import theo thứ tự để tránh lỗi khoá ngoại (Foreign Key)
    // 1. Dữ liệu gốc không phụ thuộc
    await importData('department', 'departments.json');
    await importData('role', 'roles.json');
    await importData('menu', 'menus.json');
    await importData('systemCategory', 'system_categories.json');
    await importData('dashboardCard', 'dashboard_cards.json');
    await importData('formConfig', 'form_configs.json');
    
    // 2. Import rules
    await importData('validationRule', 'rules.json');
    await importData('draftRule', 'drafts.json');
    await importData('specializedRule', 'specialized_rules.json');
    await importData('duplicateRule', 'duplicate_rules.json');

    // 3. Nhân sự và Tài khoản (Phụ thuộc Department, SystemCategory)
    await importData('staff', 'staff.json');
    await importData('user', 'users.json');
    await importData('practicingCertificate', 'practicing_certificates.json');

    // 4. Quản lý kho, Vật tư, Trang thiết bị
    await importData('warehouse', 'warehouses.json');
    await importData('inventoryVoucher', 'inventory_vouchers.json');
    await importData('equipment', 'equipments.json');
    await importData('inventoryVoucherDetail', 'inventory_voucher_details.json');
    await importData('maintenanceLog', 'maintenance_logs.json');

    // 5. Yêu cầu IT, Lỗi XML
    await importData('iTRequest', 'it_requests.json');
    await importData('requestMessage', 'request_messages.json');
    await importData('xmlErrorRecord', 'xml_error_records.json');

    // 6. Dữ liệu Catalog (Báo cáo)
    await importData('departmentCatalog', 'department_catalogs.json');
    await importData('mau02Catalog', 'mau02_catalogs.json');
    await importData('mau03Catalog', 'mau03_catalogs.json');
    await importData('mau04Catalog', 'mau04_catalogs.json');
    await importData('mau05Catalog', 'mau05_catalogs.json');
    await importData('mau06Catalog', 'mau06_catalogs.json');

    console.log('🎉 Nhập dữ liệu thành công!');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
