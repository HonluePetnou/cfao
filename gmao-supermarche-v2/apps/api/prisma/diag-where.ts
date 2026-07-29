import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const filter = {
    imputation: "PLAYCE",
    dateDebut: new Date("2026-01-01T00:00:00Z"),
    dateFin: new Date("2026-12-31T00:00:00Z")
  };

  const now = new Date();
  const dateDebut = filter.dateDebut;
  const dateFin = filter.dateFin;

  const dateFilter = (dateDebut || dateFin)
    ? {
        OR: [
          { dateFerme: { gte: dateDebut, lte: dateFin ?? now } },
          { createdAt: { gte: dateDebut, lte: dateFin ?? now } },
        ],
      }
    : {}; 

  const where = {
    ...(filter.imputation
      ? { imputation: { equals: filter.imputation, mode: "insensitive" as any } }
      : {}),
    ...dateFilter,
  };

  console.log("Constructed where clause:", JSON.stringify(where, null, 2));

  const count = await prisma.ticket.count({ where });
  console.log("Count for PLAYCE:", count);
}

main().finally(() => prisma.$disconnect());
