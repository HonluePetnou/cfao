import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning up fake/test data...");

  // 1. Delete all Rondes Journalières (test entries)
  const rondes = await prisma.rondeJournaliere.deleteMany({});
  console.log(`Deleted ${rondes.count} fake Rondes Journalières.`);

  // 2. Delete all Preventive Tasks and Plans
  const tasks = await prisma.preventiveTask.deleteMany({});
  console.log(`Deleted ${tasks.count} fake Preventive Tasks.`);
  
  const plans = await prisma.preventivePlan.deleteMany({});
  console.log(`Deleted ${plans.count} fake Preventive Plans.`);

  // 3. Delete all fake Tickets
  const tickets = await prisma.ticket.deleteMany({});
  console.log(`Deleted ${tickets.count} fake Tickets.`);

  console.log("Cleanup complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
