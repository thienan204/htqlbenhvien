const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const ins = await prisma.pageInstruction.findMany();
    for (let i = 0; i < ins.length; i++) {
        const html = ins[i].content;
        const matches = html.match(/src=["']([^"']+)["']/g);
        if (matches) {
            console.log(`Instruction ${ins[i].id} has src:`, matches.filter(m => !m.includes('data:')));
        }
    }
}

check().catch(console.error).finally(() => prisma.$disconnect());
