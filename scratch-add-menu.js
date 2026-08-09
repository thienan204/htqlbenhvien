const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        // Tủ sách hướng dẫn (for all)
        await prisma.menu.create({
            data: {
                title: 'Tủ sách Hướng dẫn',
                path: '/huong-dan',
                icon: 'BookOutlined',
                order: 99,
                isActive: true,
            }
        });

        // Quản lý hướng dẫn (Admin)
        await prisma.menu.create({
            data: {
                title: 'Quản lý Hướng dẫn',
                path: '/admin/instructions',
                icon: 'FileTextOutlined',
                order: 100,
                isActive: true,
                permissionCode: 'ADMIN' // or maybe null if permission is checked in component
            }
        });
        console.log("Menus added successfully!");
    } catch (e) {
        console.log("Error or already exists", e);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
