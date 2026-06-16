const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    console.log('Exporting data...');

    // Export Validation Rules
    const rules = await prisma.validationRule.findMany({
        orderBy: { id: 'asc' }
    });

    // Export Draft Rules
    const drafts = await prisma.draftRule.findMany({
        orderBy: { createdAt: 'asc' }
    });

    // Export Specialized Rules
    const specializedRules = await prisma.specializedRule.findMany({
        orderBy: { order: 'asc' }
    });

    // Export Duplicate Rules
    const duplicateRules = await prisma.duplicateRule.findMany({
        orderBy: { createdAt: 'asc' }
    });

    // Export Menus
    const menus = await prisma.menu.findMany({ orderBy: { id: 'asc' } });
    
    // Export Roles
    const roles = await prisma.role.findMany({ orderBy: { id: 'asc' } });

    // Export System Categories
    const systemCategories = await prisma.systemCategory.findMany({ orderBy: { id: 'asc' } });

    // Export Dashboard Cards
    const dashboardCards = await prisma.dashboardCard.findMany({ orderBy: { id: 'asc' } });

    // Export Form Configs
    const formConfigs = await prisma.formConfig.findMany({ orderBy: { id: 'asc' } });

    // Export Departments
    const departments = await prisma.department.findMany({
        orderBy: { ma_khoa: 'asc' }
    });

    // Write to files
    const seedsDir = path.join(__dirname, '../prisma/seeds');
    if (!fs.existsSync(seedsDir)) {
        fs.mkdirSync(seedsDir, { recursive: true });
    }

    fs.writeFileSync(path.join(seedsDir, 'menus.json'), JSON.stringify(menus, null, 2));
    console.log(`Exported ${menus.length} menus to prisma/seeds/menus.json`);

    fs.writeFileSync(path.join(seedsDir, 'roles.json'), JSON.stringify(roles, null, 2));
    console.log(`Exported ${roles.length} roles to prisma/seeds/roles.json`);

    fs.writeFileSync(path.join(seedsDir, 'system_categories.json'), JSON.stringify(systemCategories, null, 2));
    console.log(`Exported ${systemCategories.length} system categories to prisma/seeds/system_categories.json`);

    fs.writeFileSync(path.join(seedsDir, 'dashboard_cards.json'), JSON.stringify(dashboardCards, null, 2));
    console.log(`Exported ${dashboardCards.length} dashboard cards to prisma/seeds/dashboard_cards.json`);

    fs.writeFileSync(path.join(seedsDir, 'form_configs.json'), JSON.stringify(formConfigs, null, 2));
    console.log(`Exported ${formConfigs.length} form configs to prisma/seeds/form_configs.json`);

    fs.writeFileSync(
        path.join(seedsDir, 'rules.json'),
        JSON.stringify(rules, null, 2)
    );
    console.log(`Exported ${rules.length} rules to prisma/seeds/rules.json`);

    fs.writeFileSync(
        path.join(seedsDir, 'drafts.json'),
        JSON.stringify(drafts, null, 2)
    );
    console.log(`Exported ${drafts.length} drafts to prisma/seeds/drafts.json`);

    fs.writeFileSync(
        path.join(seedsDir, 'specialized_rules.json'),
        JSON.stringify(specializedRules, null, 2)
    );
    console.log(`Exported ${specializedRules.length} specialized rules to prisma/seeds/specialized_rules.json`);

    fs.writeFileSync(
        path.join(seedsDir, 'duplicate_rules.json'),
        JSON.stringify(duplicateRules, null, 2)
    );
    console.log(`Exported ${duplicateRules.length} duplicate rules to prisma/seeds/duplicate_rules.json`);

    fs.writeFileSync(
        path.join(seedsDir, 'departments.json'),
        JSON.stringify(departments, null, 2)
    );
    console.log(`Exported ${departments.length} departments to prisma/seeds/departments.json`);
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
