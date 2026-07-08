const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 

async function main() { 
    const menus = await prisma.menu.findMany(); 
    console.log(menus.map(m => m.path).filter(Boolean)); 
} 

main().catch(console.error).finally(() => prisma.$disconnect());
