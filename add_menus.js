const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const parent = await prisma.menu.findFirst({
        where: { title: 'Quản lý Vật tư, Thiết bị' }
    });

    if (parent) {
        await prisma.menu.createMany({
            data: [
                {
                    title: 'Sơ đồ CSDL Kho',
                    path: '/equipment-management/database-diagram',
                    icon: 'DatabaseOutlined',
                    parentId: parent.id,
                    order: 5,
                    permissionCode: null
                }
            ]
        });
        console.log('Added menus successfully');
    } else {
        console.log('Parent menu not found');
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
