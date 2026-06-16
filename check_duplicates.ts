import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const equipments = await prisma.equipment.findMany();
    const codes = equipments.map(e => e.ma_vttb);
    
    const duplicates = codes.filter((item, index) => codes.indexOf(item) !== index);
    console.log("Remaining duplicates:", duplicates);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
