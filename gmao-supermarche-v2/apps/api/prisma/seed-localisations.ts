/**
 * Migration one-shot : applique EXACTEMENT les 17 localisations par défaut
 * à TOUS les supermarchés existants. Toute localisation hors liste est supprimée.
 *
 * Usage: npx ts-node prisma/seed-localisations.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_LOCALISATIONS = [
  "Boucherie",
  "Charcuterie",
  "Boulangerie",
  "Bureaux / Locaux sociaux",
  "Chambres Froides",
  "Exterieur / Parking",
  "Galerie marchande",
  "Jules",
  "La Grande Recré",
  "Lacoste",
  "Locaux Techniques",
  "Meubles froids",
  "Patisserie",
  "Poissonerie",
  "Surface de Vente",
  "Reception",
  "Reserve",
];

const DEFAULT_SET = new Set(DEFAULT_LOCALISATIONS);

async function main() {
  const supermarkets = await prisma.supermarket.findMany({
    include: { localisations: true },
  });

  console.log(`\n🏪 ${supermarkets.length} supermarché(s) trouvé(s)\n`);

  for (const sm of supermarkets) {
    console.log(`\n► ${sm.nom} (${sm.code})`);

    // 1. Supprimer TOUT ce qui n'est pas dans la liste des 17
    const toDeleteIds = sm.localisations
      .filter((l) => !DEFAULT_SET.has(l.nom))
      .map((l) => l.id);

    if (toDeleteIds.length > 0) {
      await prisma.localisation.deleteMany({ where: { id: { in: toDeleteIds } } });
      console.log(`  ✂️  Supprimé ${toDeleteIds.length} localisation(s) hors liste`);
    }

    // 2. Calculer les noms déjà présents (ceux qui restent)
    const remainingNoms = new Set(
      sm.localisations
        .filter((l) => DEFAULT_SET.has(l.nom))
        .map((l) => l.nom)
    );

    // 3. Ajouter les manquantes
    const missing = DEFAULT_LOCALISATIONS.filter((nom) => !remainingNoms.has(nom));
    if (missing.length > 0) {
      await prisma.localisation.createMany({
        data: missing.map((nom) => ({ nom, supermarketId: sm.id })),
      });
      console.log(`  ✅ Ajouté ${missing.length} localisation(s) manquante(s)`);
    }

    // Afficher le résultat final
    const final = await prisma.localisation.findMany({
      where: { supermarketId: sm.id },
      orderBy: { nom: "asc" },
    });
    console.log(`  📋 Total: ${final.length} → [${final.map((l) => l.nom).join(", ")}]`);
  }

  console.log("\n✅ Migration terminée — chaque supermarché a exactement 17 localisations.\n");
}

main()
  .catch((e) => {
    console.error("❌ Erreur:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

