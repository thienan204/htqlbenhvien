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
            await prisma[modelName].upsert({
                where: { id: item.id || item.ma_khoa || undefined },
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
    console.log('Bắt đầu import toàn bộ dữ liệu cấu hình...');
    
    // Lưu ý: Import theo thứ tự để tránh lỗi khoá ngoại (Foreign Key)
    await importData('department', 'departments.json');
    await importData('role', 'roles.json');
    await importData('menu', 'menus.json');
    await importData('systemCategory', 'system_categories.json');
    await importData('dashboardCard', 'dashboard_cards.json');
    await importData('formConfig', 'form_configs.json');
    
    // Import rules
    await importData('validationRule', 'rules.json');
    await importData('draftRule', 'drafts.json');
    await importData('specializedRule', 'specialized_rules.json');
    await importData('duplicateRule', 'duplicate_rules.json');

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
