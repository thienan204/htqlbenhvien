import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const equipments = await prisma.equipment.findMany();
    const seen = new Set();
    
    for (const eq of equipments) {
        if (seen.has(eq.ma_vttb)) {
            const newCode = eq.ma_vttb + '-' + Math.floor(Math.random() * 10000);
            console.log(`Fixing duplicate ${eq.ma_vttb} to ${newCode}`);
            await prisma.equipment.update({
                where: { id: eq.id },
                data: { ma_vttb: newCode }
            });
            seen.add(newCode);
        } else {
            seen.add(eq.ma_vttb);
        }
    }
    console.log("Done fixing duplicates.");
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
