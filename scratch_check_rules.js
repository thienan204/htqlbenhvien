const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rules = await prisma.validationRule.findMany({ where: { active: true } });
  console.log('Active rules count:', rules.length);
  if (rules.length > 0) {
    console.log(rules.slice(0, 5));
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
