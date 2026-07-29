import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding test data for Rondes...");

  // Get first supermarket and a maintenancier
  const sm = await prisma.supermarket.findFirst();
  if (!sm) {
    console.log("No supermarkets found. Exiting.");
    return;
  }

  const user = await prisma.user.findFirst({
    where: { role: "MAINTENANCIER" }
  });
  const maintenancierId = user?.id;

  // 1. Create or update RondeConfiguration
  const zonesConfig = [
    {
      zone: "Froid Positif et Négatif",
      equipements: ["Chambre Froide Positive", "Chambre Froide Négative", "Vitrines Réfrigérées", "Groupe Froid Extérieur"],
    },
    {
      zone: "Électricité & Éclairage",
      equipements: ["TGBT (Tableau Général)", "Onduleur (UPS)", "Groupe Électrogène", "Éclairage Surface de Vente"],
    },
    {
      zone: "Climatisation & Plomberie",
      equipements: ["Cassettes Climatisation", "Groupe VRV", "Surpresseur Eau", "Sanitaires Clients"],
    }
  ];

  await prisma.rondeConfiguration.upsert({
    where: { supermarketId: sm.id },
    update: { zones: JSON.stringify(zonesConfig) },
    create: {
      supermarketId: sm.id,
      zones: JSON.stringify(zonesConfig),
    }
  });

  console.log(`Configured Rondes for supermarket: ${sm.nom}`);

  // 2. Generate past Rondes
  const pastDays = 5;
  for (let i = 0; i < pastDays; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(12, 0, 0, 0);

    // Randomize OK/NOK status. Mostly OK, sometimes NOK.
    const checksData = zonesConfig.map(z => ({
      zone: z.zone,
      equipements: z.equipements.map(nom => {
        const isNok09 = Math.random() > 0.85;
        const isNok15 = !isNok09 && Math.random() > 0.85; // If not NOK at 9h, maybe at 15h
        
        return {
          nom,
          "09h": isNok09 ? "NOK" : "OK",
          "15h": isNok15 ? "NOK" : (isNok09 ? "NOK" : "OK"), // Assume if it was NOK, it might still be NOK unless fixed
          observation: (isNok09 || isNok15) ? `Anomalie détectée sur ${nom} à ${isNok09 ? "09h" : "15h"}.` : ""
        };
      })
    }));

    // Randomize signatures based on how old the ronde is
    const hasTechSig = true; // Tech usually signs
    const hasPermSig = i > 0 || Math.random() > 0.5; // Older ones signed by Perm
    const hasDmSig = i > 1 || Math.random() > 0.7;   // Even older signed by DM

    await prisma.rondeJournaliere.create({
      data: {
        date,
        supermarketId: sm.id,
        maintenancierId,
        checks: JSON.stringify(checksData),
        observationsGenerales: `Ronde du ${date.toLocaleDateString("fr-FR")} sans incident majeur globalement.`,
        signatureTechnicien: hasTechSig ? (user?.nom || "Technicien Test") : null,
        signaturePermanent: hasPermSig ? "Manager Test" : null,
        signatureDM: hasDmSig ? "Directeur Test" : null,
      }
    });
  }

  console.log(`Created ${pastDays} test rondes journalières.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
