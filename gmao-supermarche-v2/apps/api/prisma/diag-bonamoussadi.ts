import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const sm = await prisma.supermarket.findFirst({ where: { nom: { contains: "Bonamoussadi" } } });
  console.log("Supermarket Bonamoussadi ID:", sm?.id);

  if (sm) {
    const eq = await prisma.equipment.findMany({ where: { supermarketId: sm.id }, select: { id: true } });
    const eqIds = eq.map(e => e.id);
    
    console.log("Number of equipments:", eqIds.length);

    const tickets = await prisma.ticket.findMany({
      where: {
        equipmentId: { in: eqIds },
        imputation: "PLAYCE"
      },
      select: { id: true, titre: true, createdAt: true, dateFerme: true, imputation: true }
    });

    console.log(`Tickets in Bonamoussadi for PLAYCE: ${tickets.length}`);
    for (const t of tickets) {
      console.log(`- ${t.titre} | CreatedAt: ${t.createdAt.toISOString()} | DateFerme: ${t.dateFerme?.toISOString()}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
