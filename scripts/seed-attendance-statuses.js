const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const statuses = [
        { type: 'ATTENDANCE_STATUS', code: 'DI_LAM', name: 'Đi làm', description: 'x, +', bhyt_code: 'x', order: 1, isActive: true },
        { type: 'ATTENDANCE_STATUS', code: 'TRUC', name: 'Trực viện', description: 'T, C, L, Te', bhyt_code: 'T', order: 2, isActive: true },
        { type: 'ATTENDANCE_STATUS', code: 'NGHI_BU', name: 'Nghỉ bù cả ngày', description: 'Nb', bhyt_code: 'Nb', order: 3, isActive: true },
        { type: 'ATTENDANCE_STATUS', code: 'NGHI_BU_NUA_NGAY', name: 'Nghỉ bù 1/2 ngày', description: 'Nb/2', bhyt_code: 'Nb/2', order: 4, isActive: true },
        { type: 'ATTENDANCE_STATUS', code: 'NGHI_PHEP', name: 'Nghỉ phép cả ngày', description: 'P', bhyt_code: 'P', order: 5, isActive: true },
        { type: 'ATTENDANCE_STATUS', code: 'NGHI_PHEP_NUA_NGAY', name: 'Nghỉ phép 1/2 ngày', description: 'P/2', bhyt_code: 'P/2', order: 6, isActive: true },
        { type: 'ATTENDANCE_STATUS', code: 'DI_HOC', name: 'Đi học, bồi dưỡng', description: 'H', bhyt_code: 'H', order: 7, isActive: true },
        { type: 'ATTENDANCE_STATUS', code: 'NGHI_LE', name: 'Nghỉ lễ, Tết', description: 'L', bhyt_code: 'L', order: 8, isActive: true },
        { type: 'ATTENDANCE_STATUS', code: 'NGHI_OM', name: 'Nghỉ ốm BHXH', description: 'Ô', bhyt_code: 'Ô', order: 9, isActive: true },
        { type: 'ATTENDANCE_STATUS', code: 'NGHI_THAI_SAN', name: 'Nghỉ thai sản', description: 'TS', bhyt_code: 'TS', order: 10, isActive: true },
        { type: 'ATTENDANCE_STATUS', code: 'NGHI_KHONG_LUONG', name: 'Nghỉ không lương', description: 'KL', bhyt_code: 'KL', order: 11, isActive: true }
    ];

    for (const status of statuses) {
        await prisma.systemCategory.upsert({
            where: {
                type_code: {
                    type: status.type,
                    code: status.code
                }
            },
            update: {
                name: status.name,
                description: status.description,
                bhyt_code: status.bhyt_code,
                order: status.order,
                isActive: status.isActive
            },
            create: status
        });
        console.log(`Upserted: ${status.code} - ${status.name} (${status.description})`);
    }
    console.log('Successfully seeded all 11 attendance statuses.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
