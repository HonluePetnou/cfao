import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Map Excel values to the ENUM values expected by the backend
const TYPE_MAPPING: Record<string, string> = {
  "maint. corrective": "MAINT_CORRECTIVE",
  "maint. préventive": "MAINT_PREVENTIVE",
  "maint. preventive": "MAINT_PREVENTIVE",
  "maintenance corrective": "MAINT_CORRECTIVE",
  "maintenance préventive": "MAINT_PREVENTIVE",
  "maintenance preventive": "MAINT_PREVENTIVE",
  "travaux neufs": "TRAVAUX_NEUFS",
  "travaux_neufs": "TRAVAUX_NEUFS",
  "améliorative": "MAINT_AMELIORATIVE",
  "ameliorative": "MAINT_AMELIORATIVE",
  "maint. améliorative": "MAINT_AMELIORATIVE",
};

async function main() {
  console.log("Normalizing typeTravaux values...");

  const tickets = await prisma.ticket.findMany({
    select: { id: true, typeTravaux: true }
  });

  let updated = 0;

  for (const ticket of tickets) {
    const raw = (ticket.typeTravaux || "").toLowerCase().trim();
    const normalized = TYPE_MAPPING[raw];

    if (normalized && normalized !== ticket.typeTravaux) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { typeTravaux: normalized }
      });
      updated++;
    }
  }

  console.log(`✅ Updated ${updated} tickets' typeTravaux.`);

  // Verify
  const types = await prisma.ticket.groupBy({ by: ["typeTravaux"], _count: { id: true } });
  console.log("TypesTravaux after update:", JSON.stringify(types, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
