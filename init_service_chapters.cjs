const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const defaultChapters = [
    { code: '01', name: 'Hồi sức cấp cứu và Chống độc' },
    { code: '02', name: 'Nội khoa' },
    { code: '03', name: 'Nhi khoa' },
    { code: '04', name: 'Ngoại khoa' },
    { code: '05', name: 'Phụ sản' },
    { code: '06', name: 'Mắt' },
    { code: '07', name: 'Tai Mũi Họng' },
    { code: '08', name: 'Răng Hàm Mặt' },
    { code: '09', name: 'Da liễu' },
    { code: '10', name: 'Y học cổ truyền' },
    { code: '11', name: 'Y học phục hồi' },
    { code: '12', name: 'Châm cứu' },
    { code: '13', name: 'Gây mê hồi sức' },
    { code: '14', name: 'Huyết học truyền máu' },
    { code: '15', name: 'Hóa sinh' },
    { code: '16', name: 'Vi sinh' },
    { code: '17', name: 'Giải phẫu bệnh' },
    { code: '18', name: 'Chẩn đoán hình ảnh' },
    { code: '19', name: 'Thăm dò chức năng' },
    { code: '20', name: 'Nội soi' },
    { code: '21', name: 'Da liễu - Hoa liễu' },
    { code: '22', name: 'Tâm thần' },
    { code: '23', name: 'Phục hồi chức năng' },
    { code: '24', name: 'Ung bướu' },
    { code: '25', name: 'Truyền nhiễm' },
    { code: '26', name: 'Lao và Bệnh phổi' },
    { code: '27', name: 'Y học hạt nhân' },
    { code: '28', name: 'Chuyên khoa khác' },
];

async function main() {
    try {
        console.log('Seeding Service Chapters...');
        for (const chap of defaultChapters) {
            await prisma.serviceChapter.upsert({
                where: { code: chap.code },
                update: {},
                create: chap
            });
        }
        console.log('Done seeding chapters!');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
