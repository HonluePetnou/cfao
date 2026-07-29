/**
 * Script de nettoyage :
 * 1. Supprime le supermarché "Lille" (LILLE) et tout ce qui y est rattaché
 * 2. Assigne une localisation logique à chaque équipement qui n'en a pas
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Mapping intelligent : si le nom de l'équipement contient un mot-clé
// → on lui assigne la localisation correspondante
const KEYWORD_MAP: Array<{ keywords: string[]; localisation: string }> = [
  { keywords: ["chambre froide", "centrale positive", "centrale négative", "centrale neg", "groupe de froid"], localisation: "Chambres Froides" },
  { keywords: ["meuble", "frigori", "vitrine réfrigérée", "vitrée", "bac froid", "frigo"], localisation: "Meubles froids" },
  { keywords: ["four", "pétrin", "petrin", "laminoir", "façonneuse", "diviseuse", "batteur", "trancheuse à pain"], localisation: "Boulangerie" },
  { keywords: ["hachoir", "trancheuse", "scie", "poussoir", "mélangeuse", "malaxeur", "mêlangeur"], localisation: "Boucherie" },
  { keywords: ["rooftop", "climatiseur", "split", "ventilateur", "extracteur", "climatisation"], localisation: "Locaux Techniques" },
  { keywords: ["onduleur", "ups", "groupe électrogène", "generateur", "transformateur", "tgbt", "batterie", "tableau électrique"], localisation: "Locaux Techniques" },
  { keywords: ["balance", "caisse", "scanner", "terminal", "tpe"], localisation: "Surface de Vente" },
  { keywords: ["porte", "portique", "barrière"], localisation: "Exterieur / Parking" },
  { keywords: ["surpresseur", "pompe", "aep"], localisation: "Locaux Techniques" },
  { keywords: ["friteuse", "cuisinière", "fourneau", "four à pizza", "kebab", "grill", "plancha"], localisation: "Patisserie" },
  { keywords: ["ria", "ssi", "extincteur", "incendie", "sprinkler"], localisation: "Locaux Techniques" },
  { keywords: ["boulangerie", "four à sol"], localisation: "Boulangerie" },
  { keywords: ["tombeaux", "surgel"], localisation: "Meubles froids" },
];

function findLocalisation(equipNom: string, localisations: { id: string; nom: string }[]): string | null {
  const lower = equipNom.toLowerCase();
  for (const rule of KEYWORD_MAP) {
    if (rule.keywords.some((k) => lower.includes(k.toLowerCase()))) {
      const found = localisations.find((l) => l.nom === rule.localisation);
      if (found) return found.id;
    }
  }
  return null;
}

async function main() {
  // ── 1. Supprimer Supermarché Lille ──────────────────────────────────────────
  const lille = await prisma.supermarket.findUnique({ where: { code: "LILLE" } });
  if (lille) {
    console.log(`\n🗑️  Suppression de "${lille.nom}" (${lille.code})...`);

    // Récupérer les IDs des équipements et users du supermarché
    const lilleEquips = await prisma.equipment.findMany({ where: { supermarketId: lille.id }, select: { id: true } });
    const lilleEquipIds = lilleEquips.map((e) => e.id);
    const lilleUsers = await prisma.user.findMany({ where: { supermarketId: lille.id }, select: { id: true } });
    const lilleUserIds = lilleUsers.map((u) => u.id);

    // Nullifier les références de users dans les tickets
    if (lilleUserIds.length > 0) {
      await prisma.ticket.updateMany({ where: { createdById: { in: lilleUserIds } }, data: { createdById: null } });
      await prisma.ticket.updateMany({ where: { assignedMaintenancierId: { in: lilleUserIds } }, data: { assignedMaintenancierId: null } });
    }

    // Supprimer les tickets liés aux équipements de Lille
    if (lilleEquipIds.length > 0) {
      await prisma.ticket.deleteMany({ where: { equipmentId: { in: lilleEquipIds } } });
    }

    // Supprimer plans préventifs (via equipment)
    if (lilleEquipIds.length > 0) {
      const plans = await prisma.preventivePlan.findMany({ where: { equipmentId: { in: lilleEquipIds } }, select: { id: true } });
      const planIds = plans.map((p) => p.id);
      if (planIds.length > 0) {
        await prisma.preventiveTask.deleteMany({ where: { planId: { in: planIds } } });
        await prisma.preventivePlan.deleteMany({ where: { id: { in: planIds } } });
      }
    }

    // Supprimer les rapports journaliers des maintenanciers liés à ce supermarché
    if (lilleUserIds.length > 0) {
      await prisma.rapportJournalier.deleteMany({ where: { maintenancierId: { in: lilleUserIds } } });
    }

    // Supprimer équipements, localisations, users, supermarché
    await prisma.equipment.deleteMany({ where: { supermarketId: lille.id } });
    await prisma.localisation.deleteMany({ where: { supermarketId: lille.id } });
    await prisma.user.deleteMany({ where: { supermarketId: lille.id } });
    await prisma.supermarket.delete({ where: { id: lille.id } });

    console.log(`  ✅ Supermarché Lille supprimé (${lilleEquips.length} équip., ${lilleUsers.length} users)`);
  } else {
    console.log("⚠️  Supermarché LILLE non trouvé (déjà supprimé ?)");
  }

  // ── 2. Assigner localisations aux équipements sans ──────────────────────────
  console.log("\n🔧 Assignation des localisations manquantes...");

  const supermarkets = await prisma.supermarket.findMany({
    include: { localisations: true },
  });

  let totalFixed = 0;
  let totalSkipped = 0;

  for (const sm of supermarkets) {
    const equipsSansloc = await prisma.equipment.findMany({
      where: { supermarketId: sm.id, localisationId: null },
    });

    if (equipsSansloc.length === 0) {
      console.log(`  ✓ ${sm.nom} — tous les équipements ont une localisation`);
      continue;
    }

    console.log(`\n  ► ${sm.nom} (${equipsSansloc.length} équipement(s) sans localisation)`);

    // Localisation de fallback : "Locaux Techniques"
    const fallback = sm.localisations.find((l) => l.nom === "Locaux Techniques");

    for (const eq of equipsSansloc) {
      const locId = findLocalisation(eq.nom, sm.localisations) ?? fallback?.id ?? null;
      if (locId) {
        const locNom = sm.localisations.find((l) => l.id === locId)?.nom;
        await prisma.equipment.update({ where: { id: eq.id }, data: { localisationId: locId } });
        console.log(`    ✅ "${eq.nom}" → ${locNom}`);
        totalFixed++;
      } else {
        console.log(`    ⚠️  "${eq.nom}" — aucune localisation trouvée`);
        totalSkipped++;
      }
    }
  }

  console.log(`\n📊 Résultat : ${totalFixed} équipement(s) assigné(s), ${totalSkipped} ignoré(s)`);
  console.log("✅ Terminé !\n");
}

main().catch(console.error).finally(() => prisma.$disconnect());
