const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.menu.create({
        data: {
            title: 'Lỗi XML/Chuyên đề',
            path: '/error-management/xml-errors',
            targetPath: '/error-management/xml-errors',
            icon: 'WarningOutlined',
            order: 10,
            isActive: true
        }
    });
    console.log('Menu created');
}

main().finally(() => prisma.$disconnect());
