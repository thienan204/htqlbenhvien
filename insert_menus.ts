import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check if parent menu exists
  let parentMenu = await prisma.menu.findFirst({
    where: { title: 'Quản lý Vật tư, Thiết bị' }
  });

  if (!parentMenu) {
    parentMenu = await prisma.menu.create({
      data: {
        title: 'Quản lý Vật tư, Thiết bị',
        icon: 'ToolOutlined',
        order: 90,
      }
    });
  }

  const childMenus = [
    {
      title: 'Danh mục Kho',
      path: '/equipment-management/warehouses',
      targetPath: '/equipment-management/warehouses',
      icon: 'DatabaseOutlined',
      parentId: parentMenu.id,
      order: 1
    },
    {
      title: 'Danh sách Thiết bị',
      path: '/equipment-management/list',
      targetPath: '/equipment-management/list',
      icon: 'BarcodeOutlined',
      parentId: parentMenu.id,
      order: 2
    },
    {
      title: 'Nhập xuất kho',
      path: '/equipment-management/import-vouchers',
      targetPath: '/equipment-management/import-vouchers',
      icon: 'FileAddOutlined',
      parentId: parentMenu.id,
      order: 3
    }
  ];

  for (const menu of childMenus) {
    const exists = await prisma.menu.findFirst({
      where: { path: menu.path }
    });
    
    if (!exists) {
      await prisma.menu.create({
        data: menu
      });
      console.log(`Created menu: ${menu.title}`);
    } else {
      console.log(`Menu already exists: ${menu.title}`);
    }
  }

  console.log('Done inserting menus.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
