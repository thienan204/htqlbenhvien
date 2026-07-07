const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const data = [
        { type: 'VI_TRI_BHYT', code: '1', name: '1. Người chịu trách nhiệm chuyên môn', order: 1 },
        { type: 'VI_TRI_BHYT', code: '2', name: '2. Trưởng khoa/Trưởng đơn nguyên/người phụ trách phòng khám', order: 2 },
        { type: 'VI_TRI_BHYT', code: '3', name: '3. Người chịu trách nhiệm chuyên môn kiêm trưởng khoa', order: 3 },
        { type: 'VI_TRI_BHYT', code: '4', name: '4. Người đứng đầu cơ sở KCB hoặc được uỷ quyền', order: 4 },
        { type: 'VI_TRI_BHYT', code: '5', name: '5. Người hành nghề được giao phụ trách khoa', order: 5 },
        { type: 'VI_TRI_BHYT', code: '6', name: '6. Người được ủy quyền chịu trách nhiệm CMKT theo khoản 11 Điều 27...', order: 6 },
    ];

    for (const item of data) {
        await prisma.systemCategory.upsert({
            where: {
                type_code: { type: item.type, code: item.code }
            },
            update: { name: item.name },
            create: item
        });
    }
    console.log('Seed success');
}

main().catch(console.error).finally(() => prisma.$disconnect());
