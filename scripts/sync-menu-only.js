const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    console.log('=====================================================');
    console.log('🚀 BẮT ĐẦU ĐỒNG BỘ DỮ LIỆU BẢNG MENU (CHỈ BẢNG MENU)');
    console.log('=====================================================');

    const seedsPath = path.join(__dirname, '../prisma/seeds/menus.json');
    if (!fs.existsSync(seedsPath)) {
        throw new Error(`Không tìm thấy file dữ liệu: ${seedsPath}`);
    }

    const menus = JSON.parse(fs.readFileSync(seedsPath, 'utf8'));
    console.log(`📂 Đã nạp ${menus.length} menu từ tệp ${seedsPath}`);

    // 1. Sao lưu menu cũ hiện có trong DB
    try {
        const currentMenus = await prisma.menu.findMany({ orderBy: { order: 'asc' } });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, '../prisma/seeds/backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        const backupPath = path.join(backupDir, `menu_backup_server_${timestamp}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(currentMenus, null, 2), 'utf8');
        console.log(`📦 Đã sao lưu an toàn ${currentMenus.length} menu hiện tại vào: ${backupPath}`);
    } catch (e) {
        console.warn('⚠️ Cảnh báo sao lưu:', e.message);
    }

    // 2. Tách menu Cha (parentId === null) và menu Con (parentId !== null)
    const parentMenus = menus.filter(m => !m.parentId);
    const childMenus = menus.filter(m => Boolean(m.parentId));
    console.log(`📊 Phân loại: ${parentMenus.length} Menu cha, ${childMenus.length} Menu con.`);

    // 3. Dọn dẹp bảng Menu cũ
    console.log('🧹 Đang làm sạch bảng Menu...');
    await prisma.menu.deleteMany({});

    // 4. Nạp Menu cha trước (để đảm bảo tính toàn vẹn khóa ngoại parentId)
    console.log('📥 Đang nạp danh sách Menu cha...');
    for (const p of parentMenus) {
        await prisma.menu.create({
            data: {
                id: p.id,
                title: p.title,
                path: p.path || null,
                icon: p.icon || null,
                parentId: null,
                order: p.order || 0,
                permissionCode: p.permissionCode || null,
                isActive: p.isActive !== undefined ? p.isActive : true,
                isAdminOnly: Boolean(p.isAdminOnly),
                status: p.status || 'OFFICIAL',
                isSpecialGroup: p.isSpecialGroup || null,
                targetPath: p.targetPath || null,
                showInPaths: p.showInPaths || []
            }
        });
    }

    // 5. Nạp Menu con sau
    console.log('📥 Đang nạp danh sách Menu con...');
    for (const c of childMenus) {
        await prisma.menu.create({
            data: {
                id: c.id,
                title: c.title,
                path: c.path || null,
                icon: c.icon || null,
                parentId: c.parentId,
                order: c.order || 0,
                permissionCode: c.permissionCode || null,
                isActive: c.isActive !== undefined ? c.isActive : true,
                isAdminOnly: Boolean(c.isAdminOnly),
                status: c.status || 'OFFICIAL',
                isSpecialGroup: c.isSpecialGroup || null,
                targetPath: c.targetPath || null,
                showInPaths: c.showInPaths || []
            }
        });
    }

    // 6. Kiểm tra lại kết quả sau khi nạp
    const finalCount = await prisma.menu.count();
    const finalParents = await prisma.menu.count({ where: { parentId: null } });
    const finalChildren = await prisma.menu.count({ where: { parentId: { not: null } } });

    console.log('=====================================================');
    console.log(`✅ HOÀN TẤT ĐỒNG BỘ! Tổng cộng: ${finalCount} menu.`);
    console.log(`   - Menu cha: ${finalParents}`);
    console.log(`   - Menu con: ${finalChildren}`);
    console.log('=====================================================');
}

main()
    .catch((e) => {
        console.error('❌ Lỗi khi đồng bộ menu:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
