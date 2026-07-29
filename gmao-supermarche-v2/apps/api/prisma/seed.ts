import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("admin123", 10);

  // Clean existing data
  await prisma.rapportJournalier.deleteMany({});
  await prisma.preventiveTask.deleteMany({});
  await prisma.preventivePlan.deleteMany({});
  await prisma.ticket.deleteMany({});
  await prisma.equipment.deleteMany({});
  await prisma.localisation.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.supermarket.deleteMany({});

  // Supermarket
  const sm = await prisma.supermarket.create({
    data: { nom: "Supermarché Lille", code: "LILLE" },
  });

  // Localisation
  const loc = await prisma.localisation.create({
    data: { nom: "Boucherie", supermarketId: sm.id },
  });

  // Equipment
  await prisma.equipment.create({
    data: {
      nom: "Chambre froide",
      supermarketId: sm.id,
      localisationId: loc.id,
      criticite: "haute",
    },
  });

  // Users
  await prisma.user.create({
    data: { nom: "Admin", email: "admin@gmao.local", password, role: "SUPER_ADMIN" },
  });

  await prisma.user.create({
    data: { nom: "Technicien Lille", email: "tech.lille@gmao.local", password, role: "MAINTENANCIER" },
  });

  await prisma.user.create({
    data: {
      nom: "Charcutier Lille",
      email: "user.lille@gmao.local",
      password,
      role: "USER",
      supermarketId: sm.id,
      localisationId: loc.id,
    },
  });

  console.log("Seed completed");
}

main().catch(console.error).finally(() => prisma.$disconnect());
