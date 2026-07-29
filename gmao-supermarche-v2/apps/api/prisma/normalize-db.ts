import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Normalisation des valeurs de typeTravaux dans la base de données...");

  const tickets = await prisma.ticket.findMany({
    select: { id: true, typeTravaux: true },
  });

  let updated = 0;

  for (const t of tickets) {
    if (!t.typeTravaux) continue;

    let target = t.typeTravaux;
    const lower = t.typeTravaux.toLowerCase();

    if (lower.includes("corrective") || lower.includes("curative")) {
      target = "MAINT_CORRECTIVE";
    } else if (lower.includes("préventive") || lower.includes("preventive")) {
      target = "MAINT_PREVENTIVE";
    } else if (lower.includes("améliorative") || lower.includes("ameliorative")) {
      target = "MAINT_AMELIORATIVE";
    } else if (lower.includes("neufs") || lower.includes("neuf")) {
      target = "TRAVAUX_NEUFS";
    }

    if (target !== t.typeTravaux) {
      await prisma.ticket.update({
        where: { id: t.id },
        data: { typeTravaux: target },
      });
      updated++;
    }
  }

  console.log(`✅ Terminé ! ${updated} ticket(s) mis à jour.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
