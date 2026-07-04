const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const rawData = fs.readFileSync('scratch/tt32_data.json', 'utf8');
        const tt32Data = JSON.parse(rawData);
        
        console.log('Clearing old catalog data...');
        await prisma.tT32ServiceCatalog.deleteMany();
        
        let totalInserted = 0;
        
        for (const [categoryName, services] of Object.entries(tt32Data)) {
            console.log(`Processing category: ${categoryName} (${services.length} services)`);
            
            // Insert in batches of 1000 to avoid query limits
            const batchSize = 1000;
            for (let i = 0; i < services.length; i += batchSize) {
                const batch = services.slice(i, i + batchSize);
                
                await prisma.tT32ServiceCatalog.createMany({
                    data: batch.map(s => ({
                        category_name: categoryName,
                        group_name: s.group || 'Chung',
                        code: s.code || '',
                        name: s.name || ''
                    }))
                });
                totalInserted += batch.length;
            }
        }
        
        console.log(`Done! Total inserted: ${totalInserted} services.`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
