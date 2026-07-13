const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 

async function main() { 
    const parentMenu = await prisma.menu.findFirst({where: {title: 'CHUYÊN ĐỀ'}}); 
    if(parentMenu) { 
        // Check if it already exists
        const existing = await prisma.menu.findFirst({where: {path: '/chuyen-de/ho-so-da-gui'}});
        if (!existing) {
            await prisma.menu.create({ 
                data: { 
                    title: 'DS Hồ Sơ Đã Gửi', 
                    path: '/chuyen-de/ho-so-da-gui', 
                    parentId: parentMenu.id, 
                    order: 10, 
                    isActive: true, 
                    icon: 'FileText' 
                } 
            }); 
            console.log('Added menu'); 
        } else {
            console.log('Menu already exists');
        }
    } else { 
        console.log('Parent menu not found'); 
    } 
} 

main().catch(console.error).finally(()=>prisma.$disconnect());
