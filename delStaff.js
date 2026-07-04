const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    await prisma.practicingCertificate.deleteMany();
    await prisma.staff.deleteMany();
    console.log('Deleted all staff');
}
main().catch(console.error).finally(() => prisma.$disconnect());
