const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.menu.updateMany({
        where: {
            path: {
                in: [
                    '/equipment-management/export-vouchers',
                    '/equipment-management/reports/inventory'
                ]
            }
        },
        data: {
            permissionCode: null
        }
    });
    console.log('Fixed permissions');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
