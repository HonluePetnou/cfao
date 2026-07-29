import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const eq = await prisma.equipment.findMany({ include: { localisation: true }, take: 10 }); 
  console.log(eq.map(e => `${e.nom} -> ${e.localisation?.nom}`));
}

main().finally(() => prisma.$disconnect());
