const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const settings = [
    {
      eventCode: 'XML_ERROR_NEW',
      eventName: 'Có lỗi XML mới',
      isEnabled: true,
    },
    {
      eventCode: 'IT_REQUEST_NEW',
      eventName: 'Có yêu cầu hỗ trợ IT mới',
      isEnabled: true,
    },
    {
      eventCode: 'EQUIPMENT_MAINTENANCE',
      eventName: 'Có yêu cầu bảo trì thiết bị',
      isEnabled: true,
    },
  ];

  for (const s of settings) {
    await prisma.notificationSetting.upsert({
      where: { eventCode: s.eventCode },
      update: {},
      create: s,
    });
  }

  console.log('Seeded notification settings');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
