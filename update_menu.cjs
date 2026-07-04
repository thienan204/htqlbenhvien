const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        // Find existing menu to revert title
        const staffMenu = await prisma.menu.findFirst({
            where: { path: '/staff' }
        });

        if (staffMenu) {
            await prisma.menu.update({
                where: { id: staffMenu.id },
                data: { title: 'Quản lý Nhân sự' }
            });
            console.log('Renamed /staff menu to "Quản lý Nhân sự"');
        }

        // Add new menu Quản lý CCHN
        const exists = await prisma.menu.findFirst({
            where: { path: '/practicing-certificates' }
        });

        if (!exists) {
            await prisma.menu.create({
                data: {
                    title: 'Quản lý CCHN',
                    path: '/practicing-certificates',
                    icon: 'IdcardOutlined',
                    parentId: staffMenu ? staffMenu.parentId : null,
                    order: (staffMenu ? staffMenu.order : 0) + 1,
                    isActive: true
                }
            });
            console.log('Created /practicing-certificates menu');
        } else {
            console.log('/practicing-certificates menu already exists');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
