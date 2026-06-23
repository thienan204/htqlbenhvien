const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Check if it exists
    const existing = await prisma.menu.findFirst({
        where: { path: '/docs' }
    });

    if (existing) {
        console.log('Menu /docs already exists.');
        return;
    }

    await prisma.menu.create({
        data: {
            title: 'Sổ tay Hướng dẫn',
            path: '/docs',
            icon: 'BookOutlined',
            parentId: null, // Top-level
            order: 99, // Put it at the bottom
            permissionCode: null
        }
    });
    console.log('Added docs menu successfully');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
