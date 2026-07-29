import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const g = await prisma.ticket.groupBy({
    by: ["typeTravaux"],
    _count: { id: true }
  });
  console.log("TYPE_TRAVAUX_DISTRIBUTION:", JSON.stringify(g, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
