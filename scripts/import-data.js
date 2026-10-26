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
            let whereClause = { id: item.id };
            const updateData = { ...item };
            delete updateData.id;

            if (modelName === 'department') whereClause = { ma_khoa: item.ma_khoa };
            else if (modelName === 'role') whereClause = { code: item.code };
            else if (modelName === 'warehouse') whereClause = { code: item.code };
            else if (modelName === 'equipment') whereClause = { ma_vttb: item.ma_vttb };
            else if (modelName === 'inventoryVoucher') whereClause = { voucher_code: item.voucher_code };
            else if (modelName === 'pageInstruction') whereClause = { pageId: item.pageId };
            else if (modelName === 'formConfig') whereClause = { formId: item.formId };
            else if (modelName === 'systemCategory') {
                await prisma.systemCategory.upsert({
                    where: { type_code: { type: item.type, code: item.code } },
                    update: updateData,
                    create: item
                });
                continue;
            }
            else if (modelName === 'staff') {
                const staffWhere = item.ma_nv ? { ma_nv: item.ma_nv } : { id: item.id };
                await prisma.staff.upsert({
                    where: staffWhere,
                    update: updateData,
                    create: item
                });
                continue;
            }
            else if (modelName === 'user') {
                try {
                    await prisma.user.upsert({
                        where: { username: item.username },
                        update: updateData,
                        create: item
                    });
                } catch (uErr) {
                    if (uErr.message && uErr.message.includes('staffId')) {
                        const { staffId, ...updateWithoutStaff } = updateData;
                        const { staffId: sId, ...createWithoutStaff } = item;
                        await prisma.user.upsert({
                            where: { username: item.username },
                            update: updateWithoutStaff,
                            create: createWithoutStaff
                        });
                    } else {
                        throw uErr;
                    }
                }
                continue;
            }

            await prisma[modelName].upsert({
                where: whereClause,
                update: updateData,
                create: item
            });
        } catch (error) {
            console.error(`Lỗi khi import ${modelName}:`, error.message);
        }
    }
    console.log(`✅ Import xong ${modelName}.`);
}

async function main() {
    const importAll = process.argv.includes('--all') || process.argv.includes('--full');
    
    console.log('===================================================');
    if (importAll) {
        console.log('📦 Chế độ: IMPORT TOÀN BỘ (Dành cho khởi tạo server mới tinh)');
    } else {
        console.log('⚙️ Chế độ an toàn: CHỈ import Cấu hình hệ thống, Menu, Danh mục, Quy tắc & Hướng dẫn');
        console.log('💡 (Để import toàn bộ dữ liệu mẫu cả User/Phiếu yêu cầu: node scripts/import-data.js --all)');
    }
    console.log('===================================================');
    
    // 1. Dữ liệu cấu hình & danh mục hệ thống (Luôn an toàn để cập nhật)
    await importData('department', 'departments.json');
    await importData('role', 'roles.json');
    await importData('menu', 'menus.json');
    await importData('systemCategory', 'system_categories.json');
    await importData('dashboardCard', 'dashboard_cards.json');
    await importData('formConfig', 'form_configs.json');
    
    // 2. Quy tắc nghiệp vụ (Rules)
    await importData('validationRule', 'rules.json');
    await importData('draftRule', 'drafts.json');
    await importData('specializedRule', 'specialized_rules.json');
    await importData('duplicateRule', 'duplicate_rules.json');

    // 3. Hướng dẫn sử dụng & Lịch sử cập nhật
    await importData('pageInstruction', 'page_instructions.json');
    await importData('featureChangeLog', 'feature_change_logs.json');
    await importData('featureFeedback', 'feature_feedbacks.json');

    // 4. Dữ liệu nghiệp vụ vận hành (Chỉ import khi có cờ --all khi dựng server mới)
    if (importAll) {
        console.log('\n--- Đang import dữ liệu nghiệp vụ (User, Staff, Thiết bị, Phiếu yêu cầu)... ---');
        await importData('staff', 'staff.json');
        await importData('user', 'users.json');
        await importData('practicingCertificate', 'practicing_certificates.json');

        await importData('warehouse', 'warehouses.json');
        await importData('inventoryVoucher', 'inventory_vouchers.json');
        await importData('equipment', 'equipments.json');
        await importData('inventoryVoucherDetail', 'inventory_voucher_details.json');
        await importData('maintenanceLog', 'maintenance_logs.json');

        await importData('iTRequest', 'it_requests.json');
        await importData('requestMessage', 'request_messages.json');
        await importData('xmlErrorRecord', 'xml_error_records.json');

        await importData('departmentCatalog', 'department_catalogs.json');
        await importData('mau02Catalog', 'mau02_catalogs.json');
        await importData('mau03Catalog', 'mau03_catalogs.json');
        await importData('mau04Catalog', 'mau04_catalogs.json');
        await importData('mau05Catalog', 'mau05_catalogs.json');
        await importData('mau06Catalog', 'mau06_catalogs.json');
    }

    console.log('\n🎉 Hoàn tất quá trình nhập dữ liệu!');
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
