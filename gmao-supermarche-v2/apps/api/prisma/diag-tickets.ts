import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Check typeTravaux values actually stored
  const types = await prisma.ticket.groupBy({ by: ["typeTravaux"], _count: { id: true } });
  console.log("TypesTravaux stored:", JSON.stringify(types, null, 2));
  
  // Check cout values
  const withCout = await prisma.ticket.count({ where: { cout: { not: null, gt: 0 } } });
  console.log("Tickets with cout > 0:", withCout);
  
  // Check financement values
  const financements = await prisma.ticket.groupBy({ by: ["financement"], _count: { id: true } });
  console.log("Financements:", JSON.stringify(financements, null, 2));

  // Check imputation values
  const imputations = await prisma.ticket.groupBy({ by: ["imputation"], _count: { id: true } });
  console.log("Imputations:", JSON.stringify(imputations, null, 2));

  // Check corpsEtat values
  const corps = await prisma.ticket.groupBy({ by: ["corpsEtat"], _count: { id: true } });
  console.log("CorpsEtat:", JSON.stringify(corps, null, 2));

  // Show a sample ticket
  const sample = await prisma.ticket.findFirst();
  console.log("Sample ticket:", JSON.stringify(sample, null, 2));
}

main().finally(() => prisma.$disconnect());
