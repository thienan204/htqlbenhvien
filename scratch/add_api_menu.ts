import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    // Check if it exists
    const existing = await prisma.menu.findFirst({ where: { path: '/api-management' } });
    if (existing) {
        console.log('Menu already exists.');
        return;
    }

    // Add API Management menu
    await prisma.menu.create({
        data: {
            title: 'Quản lý API',
            path: '/api-management',
            icon: 'ApiOutlined', // We'll use ApiOutlined from Ant Design
            isActive: true,
            order: 99,
            isSpecialGroup: 'OTHER'
        }
    });
    console.log('Menu Quản lý API added successfully.');
}
run().finally(() => prisma.$disconnect());
