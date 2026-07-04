const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    try {
        // Find "Chuyên đề" parent
        const chuyenDe = await prisma.menu.findFirst({ where: { title: { contains: 'Chuyên đề' } } });
        
        await prisma.menu.create({
            data: {
                title: 'Phạm vi chuyên môn',
                path: '/my-services',
                targetPath: '/my-services',
                icon: 'UserOutlined',
                permissionCode: null, // anyone logged in
                parentId: null,
                order: 90
            }
        });
        console.log('Added My Services Menu');

        await prisma.menu.create({
            data: {
                title: 'Check CCHN',
                path: '/chuyen-de/kiem-tra-cchn',
                targetPath: '/chuyen-de/kiem-tra-cchn',
                icon: 'SafetyCertificateOutlined',
                permissionCode: 'MENU_CHUYEN_DE',
                parentId: chuyenDe ? chuyenDe.id : null,
                order: 91
            }
        });
        console.log('Added Check CCHN Menu');
    } catch(e) { console.error(e) }
}
main();
