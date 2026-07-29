import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TARGET_LOCALISATIONS = [
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
  "Poissonnerie",
  "Surface de Vente",
  "Reception",
  "Reserve"
];

// Mapping from old localisation names to the new ones
const MAPPING: Record<string, string> = {
  "Boucherie / Charcuterie": "Boucherie",
  "Boulangerie / Pâtisserie": "Boulangerie",
  "Fruits & Légumes": "Surface de Vente",
  "Produits laitiers": "Meubles froids",
  "Stock & Chambres froides": "Chambres Froides",
  "Caisse / Accueil": "Surface de Vente",
  "Entrée / Caisses": "Surface de Vente",
  "Rayon produit laitier": "Meubles froids",
  "Rayon fruits et légumes": "Surface de Vente",
  "Traiteur": "Surface de Vente",
  "Atelier Stock": "Reserve",
  "IT": "Bureaux / Locaux sociaux",
  "Local photovoltaïque": "Locaux Techniques",
  "Local chambres froides": "Locaux Techniques",
  "Compartiment froid": "Meubles froids",
  "Toilettes": "Bureaux / Locaux sociaux",
  "Froid alimentaire": "Meubles froids",
  "Équipements de Production": "Locaux Techniques",
  "Électricité": "Locaux Techniques",
  "Climatisation / Ventilation": "Locaux Techniques",
  "Génie Civil / Bâtiment": "Locaux Techniques",
  "Plomberie": "Locaux Techniques",
  "Mécanique": "Locaux Techniques",
  "Moyens de secours": "Locaux Techniques",
  "Extérieur / Parking": "Exterieur / Parking",
  "Bureaux / Locaux sociaux": "Bureaux / Locaux sociaux",
  "Surface de Vente": "Surface de Vente"
};

async function main() {
  console.log("Normalizing localisations across all supermarkets...");

  const supermarkets = await prisma.supermarket.findMany();

  for (const sm of supermarkets) {
    console.log(`\nProcessing supermarket: ${sm.nom}`);
    
    // 1. Create the 17 target localisations if they don't exist
    const targetMap = new Map<string, string>();
    for (const name of TARGET_LOCALISATIONS) {
      let loc = await prisma.localisation.findFirst({
        where: { nom: name, supermarketId: sm.id }
      });
      if (!loc) {
        loc = await prisma.localisation.create({
          data: { nom: name, supermarketId: sm.id }
        });
      }
      targetMap.set(name, loc.id);
    }

    // 2. Map existing equipments to the new localisations
    const allEquips = await prisma.equipment.findMany({
      where: { supermarketId: sm.id },
      include: { localisation: true }
    });

    for (const equip of allEquips) {
      if (equip.localisation) {
        const oldName = equip.localisation.nom;
        // If it's already one of the targets, leave it or re-link to the guaranteed target ID
        if (TARGET_LOCALISATIONS.includes(oldName)) {
          await prisma.equipment.update({
            where: { id: equip.id },
            data: { localisationId: targetMap.get(oldName) }
          });
        } else {
          // Find mapping
          const newName = MAPPING[oldName] || "Surface de Vente"; // fallback
          await prisma.equipment.update({
            where: { id: equip.id },
            data: { localisationId: targetMap.get(newName) }
          });
        }
      }
    }

    // 3. Delete any localisations that are NOT in the target list
    const allLocs = await prisma.localisation.findMany({
      where: { supermarketId: sm.id }
    });

    const toDelete = allLocs.filter(loc => !TARGET_LOCALISATIONS.includes(loc.nom));
    
    for (const loc of toDelete) {
      await prisma.localisation.delete({ where: { id: loc.id } });
    }
    
    console.log(`  Created targets. Remapped equipments. Deleted ${toDelete.length} old localisations.`);
  }

  console.log("\n✅ Done normalizing localisations!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
