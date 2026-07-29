import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Equipments:", await prisma.equipment.count());
  console.log("Localisations:", await prisma.localisation.count());
  console.log("Users:", await prisma.user.count());
}

main().finally(() => prisma.$disconnect());
