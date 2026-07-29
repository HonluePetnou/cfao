import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Syncing Ronde Configuration to match physical Fiche de Ronde for all supermarkets...");

  const supermarkets = await prisma.supermarket.findMany();
  
  if (supermarkets.length === 0) {
    console.log("No supermarkets found. Exiting.");
    return;
  }

  const zonesConfig = [
    {
      zone: "SURFACE DE VENTE",
      equipements: ["ECLAIRAGE MAGASIN", "PORTE AUTOMATIQUE", "SONNORISATION"],
    },
    {
      zone: "LABORATOIRE BOULANGERIE",
      equipements: ["FACONNEUSE", "FOUR 1 et 2", "BALANCELLE", "DIVISEUSE", "TRANCHEUSE A PAINS", "CHAMBRE DE FERMENTATIONS", "PETRIN"],
    },
    {
      zone: "TRAITEUR",
      equipements: ["FOUR 4 FEUX", "FRITEUSE", "FOUR A PIZZA", "MACHINE KEBAB 1", "EXTRACTEUR", "MACHINE KEBAB 2"],
    },
    {
      zone: "CHARCUTERIE",
      equipements: ["MEUBLE CHARCUTERIE", "TRANCHEUSE HALAL", "TRANCHEUSE"],
    },
    {
      zone: "POISSONNERIE",
      equipements: ["PONDEUSE A GLACE", "SCIES A OS"],
    },
    {
      zone: "BOUCHERIE",
      equipements: ["SOUS VIDEUSE", "GRANDE SCIE A OS", "PETITE SCIE A OS", "INSECT-KILLERS", "MEUBLES", "LE POUSSOIR", "MELANGEUR"],
    },
    {
      zone: "RECEPTION",
      equipements: ["BALANCE", "GERBEUR", "presse à balles", "chariot"],
    },
    {
      zone: "CLIMATISATION",
      equipements: ["ROOFTOP", "CLIMATISATION BUREAUX"],
    },
    {
      zone: "ALIMENTATION EN EAU",
      equipements: ["VERIFIER L'ARRIVEE D'EAU DANS LABOS"],
    },
    {
      zone: "SOURCE D'ENERGIE AU MOMENT DE LA RONDE",
      equipements: ["SOURCE D'ENERGIE"],
    },
    {
      zone: "CHAMBRES FROIDES POSITIVE",
      equipements: ["CHAMBRES FROIDES POSITIVE"],
    },
    {
      zone: "GROUPE ELECTROGENE",
      equipements: ["STOCK GASOIL ET FONCTIONNEMENT GE PLAYCE", "STOCK GASOIL ET FONCTIONNEMENT GE ADIALEA"],
    },
    {
      zone: "AUTRES MEUBLES",
      equipements: ["AUTRES MEUBLES"],
    },
    {
      zone: "CHAMBRES FROIDES NEGATIVE",
      equipements: ["CHAMBRES FROIDES NEGATIVE"],
    }
  ];

  let configCreated = 0;

  for (const sm of supermarkets) {
    await prisma.rondeConfiguration.upsert({
      where: { supermarketId: sm.id },
      update: { zones: JSON.stringify(zonesConfig) },
      create: {
        supermarketId: sm.id,
        zones: JSON.stringify(zonesConfig),
      }
    });
    console.log(`✓ Configured Rondes for supermarket: ${sm.nom}`);
    configCreated++;
  }

  console.log(`✅ Done syncing Ronde Configuration across ${configCreated} supermarkets!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
