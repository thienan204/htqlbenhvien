const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const staffMenu = await prisma.menu.findFirst({
            where: { path: '/staff' }
        });

        const exists = await prisma.menu.findFirst({
            where: { path: '/tt32' }
        });

        if (!exists) {
            await prisma.menu.create({
                data: {
                    title: 'Cấu hình Danh mục TT32',
                    path: '/tt32',
                    icon: 'SettingOutlined',
                    parentId: staffMenu ? staffMenu.parentId : null,
                    order: (staffMenu ? staffMenu.order : 0) + 2,
                    isActive: true
                }
            });
            console.log('Created /tt32 menu');
        } else {
            console.log('/tt32 menu already exists');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
