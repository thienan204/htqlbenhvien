const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting migration...');
    const certs = await prisma.practicingCertificate.findMany();
    let migratedCount = 0;
    
    for (const cert of certs) {
        if (cert.pham_vi_hanh_nghe) {
            const parts = cert.pham_vi_hanh_nghe.split(';');
            for (let p of parts) {
                const match = p.trim().match(/^(\d+)/);
                if (match && match[1]) {
                    const ma_pham_vi = match[1];
                    try {
                        const exists = await prisma.scopeOfPracticeCatalog.findUnique({
                            where: { ma_pham_vi }
                        });
                        if (exists) {
                            await prisma.cCHNScopeMapping.upsert({
                                where: {
                                    cchn_id_ma_pham_vi: {
                                        cchn_id: cert.id,
                                        ma_pham_vi: ma_pham_vi
                                    }
                                },
                                update: {},
                                create: {
                                    cchn_id: cert.id,
                                    ma_pham_vi: ma_pham_vi
                                }
                            });
                        }
                    } catch (err) {
                        console.error('Error migrating scope:', ma_pham_vi, 'for cert:', cert.id);
                    }
                }
            }
        }
        
        // Migrate noi_cap_cchn
        if (cert.noi_cap_cchn) {
            try {
                let category = await prisma.systemCategory.findFirst({
                    where: { type: 'NOI_CAP_CCHN', name: cert.noi_cap_cchn }
                });
                
                if (!category) {
                    category = await prisma.systemCategory.create({
                        data: {
                            type: 'NOI_CAP_CCHN',
                            code: cert.noi_cap_cchn.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase(),
                            name: cert.noi_cap_cchn
                        }
                    });
                }
                
                await prisma.practicingCertificate.update({
                    where: { id: cert.id },
                    data: { noi_cap_cchn_id: category.id }
                });
            } catch (err) {
                console.error('Error migrating noi_cap_cchn:', cert.noi_cap_cchn, 'for cert:', cert.id);
            }
        }
        
        migratedCount++;
        if (migratedCount % 100 === 0) console.log(`Migrated ${migratedCount} certs...`);
    }
    
    console.log(`Migration complete for ${migratedCount} certs!`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
