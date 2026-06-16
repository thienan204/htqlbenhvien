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

    // ----------------------------------------------------
    // Export Data (Staff, User, Warehouse, Equipment, etc.)
    // ----------------------------------------------------
    const staff = await prisma.staff.findMany({ orderBy: { id: 'asc' } });
    const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });
    const practicingCertificates = await prisma.practicingCertificate.findMany({ orderBy: { id: 'asc' } });
    const warehouses = await prisma.warehouse.findMany({ orderBy: { id: 'asc' } });
    const equipments = await prisma.equipment.findMany({ orderBy: { id: 'asc' } });
    const inventoryVouchers = await prisma.inventoryVoucher.findMany({ orderBy: { id: 'asc' } });
    const inventoryVoucherDetails = await prisma.inventoryVoucherDetail.findMany({ orderBy: { id: 'asc' } });
    const maintenanceLogs = await prisma.maintenanceLog.findMany({ orderBy: { id: 'asc' } });
    const itRequests = await prisma.iTRequest.findMany({ orderBy: { id: 'asc' } });
    const requestMessages = await prisma.requestMessage.findMany({ orderBy: { id: 'asc' } });
    const xmlErrorRecords = await prisma.xmlErrorRecord.findMany({ orderBy: { id: 'asc' } });
    const departmentCatalogs = await prisma.departmentCatalog.findMany({ orderBy: { id: 'asc' } });
    const mau02Catalogs = await prisma.mau02Catalog.findMany({ orderBy: { id: 'asc' } });
    const mau03Catalogs = await prisma.mau03Catalog.findMany({ orderBy: { id: 'asc' } });
    const mau04Catalogs = await prisma.mau04Catalog.findMany({ orderBy: { id: 'asc' } });
    const mau05Catalogs = await prisma.mau05Catalog.findMany({ orderBy: { id: 'asc' } });
    const mau06Catalogs = await prisma.mau06Catalog.findMany({ orderBy: { id: 'asc' } });

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

    const additionalExports = [
        { name: 'staff.json', data: staff },
        { name: 'users.json', data: users },
        { name: 'practicing_certificates.json', data: practicingCertificates },
        { name: 'warehouses.json', data: warehouses },
        { name: 'equipments.json', data: equipments },
        { name: 'inventory_vouchers.json', data: inventoryVouchers },
        { name: 'inventory_voucher_details.json', data: inventoryVoucherDetails },
        { name: 'maintenance_logs.json', data: maintenanceLogs },
        { name: 'it_requests.json', data: itRequests },
        { name: 'request_messages.json', data: requestMessages },
        { name: 'xml_error_records.json', data: xmlErrorRecords },
        { name: 'department_catalogs.json', data: departmentCatalogs },
        { name: 'mau02_catalogs.json', data: mau02Catalogs },
        { name: 'mau03_catalogs.json', data: mau03Catalogs },
        { name: 'mau04_catalogs.json', data: mau04Catalogs },
        { name: 'mau05_catalogs.json', data: mau05Catalogs },
        { name: 'mau06_catalogs.json', data: mau06Catalogs },
    ];

    for (const exp of additionalExports) {
        fs.writeFileSync(path.join(seedsDir, exp.name), JSON.stringify(exp.data, null, 2));
        console.log(`Exported ${exp.data.length} records to prisma/seeds/${exp.name}`);
    }
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
