import { PrismaClient, PlanIntervalUnit } from "@prisma/client";

const prisma = new PrismaClient();

type PlanData = {
  nom: string;
  periodiciteAn: number;
};

const SITE_PLANS: Record<string, PlanData[]> = {
  "Carrefour Market Bonamoussadi": [
    { nom: "Groupe électrogène (01)", periodiciteAn: 12 },
    { nom: "Onduleur", periodiciteAn: 6 },
    { nom: "Climatisation Roof Top", periodiciteAn: 12 },
  ],
  "Carrefour Market Bonaberi": [
    { nom: "Groupe électrogène (01)", periodiciteAn: 12 },
    { nom: "Onduleurs 60kVA", periodiciteAn: 6 },
    { nom: "Onduleur 40kVA", periodiciteAn: 6 },
    { nom: "Batterie de compensation d'énergie réactive 150kVAR", periodiciteAn: 1 },
    { nom: "Système de Détection incendie", periodiciteAn: 1 },
    { nom: "Climatisation Roof Top", periodiciteAn: 12 },
    { nom: "Surpresseurs / traitement AEP / RIA", periodiciteAn: 4 },
  ],
  "Carrefour Market Ancien Dalip": [
    { nom: "Groupe électrogène (01)", periodiciteAn: 12 },
    { nom: "Onduleur", periodiciteAn: 6 },
    { nom: "Système de Détection incendie", periodiciteAn: 1 },
    { nom: "Climatisation Roof Top", periodiciteAn: 12 },
    { nom: "Surpresseurs / traitement AEP / RIA", periodiciteAn: 4 },
  ],
  "Carrefour Market Akwa-Dubai": [
    { nom: "Groupe électrogène (01)", periodiciteAn: 12 },
    { nom: "Onduleur", periodiciteAn: 6 },
    { nom: "Système de Détection incendie", periodiciteAn: 1 },
    { nom: "Climatisation Roof Top", periodiciteAn: 12 },
    { nom: "Surpresseurs / traitement AEP / RIA", periodiciteAn: 4 },
  ],
  "Carrefour Market Logbom": [
    { nom: "Groupe électrogène AKSA AD 510 (510 kVA)", periodiciteAn: 12 },
    { nom: "Stabilisateur DELTA SRV 33 (300 kVA) + Onduleur Schneider Electric EasyUPS 3S", periodiciteAn: 6 },
    { nom: "Poste de transformation : Transformateurs + cellules", periodiciteAn: 1 },
    { nom: "Batterie de compensation d'énergie réactive", periodiciteAn: 1 },
    { nom: "Système de Détection incendie", periodiciteAn: 4 },
    { nom: "Anti-intrusion", periodiciteAn: 4 },
    { nom: "Portes vitrées automatiques coulissantes", periodiciteAn: 2 },
    { nom: "Climatisation Roof Top", periodiciteAn: 12 },
    { nom: "Climatisation Split + Rideaux d'air", periodiciteAn: 12 },
    { nom: "Ventilation et Extraction", periodiciteAn: 12 },
    { nom: "Extinction Incendie : Surpresseurs / traitement AEP / RIA / Extincteurs", periodiciteAn: 6 },
    { nom: "Coffret et tableaux électriques y compris TGBT", periodiciteAn: 2 },
  ],
};

function getInterval(periodiciteAn: number): { value: number; unit: PlanIntervalUnit } {
  if (periodiciteAn === 12) return { value: 1, unit: "MONTHS" };
  if (periodiciteAn === 6) return { value: 2, unit: "MONTHS" };
  if (periodiciteAn === 4) return { value: 3, unit: "MONTHS" };
  if (periodiciteAn === 3) return { value: 4, unit: "MONTHS" };
  if (periodiciteAn === 2) return { value: 6, unit: "MONTHS" };
  if (periodiciteAn === 1) return { value: 1, unit: "YEARS" };
  
  // Default fallback if unusual (like 24/an or something)
  return { value: Math.floor(12 / periodiciteAn), unit: "MONTHS" };
}

async function main() {
  console.log("Loading Preventive Plans 2026...");

  const supermarkets = await prisma.supermarket.findMany();
  
  let totalPlans = 0;

  for (const sm of supermarkets) {
    const plansToCreate = SITE_PLANS[sm.nom];
    
    if (!plansToCreate) {
      console.log(`No plans defined for ${sm.nom}, skipping.`);
      continue;
    }

    // Default localisation for these technical equipments
    let defaultLoc = await prisma.localisation.findFirst({
      where: { nom: "Locaux Techniques", supermarketId: sm.id }
    });
    
    if (!defaultLoc) {
      defaultLoc = await prisma.localisation.findFirst({ where: { supermarketId: sm.id } });
    }

    for (const planData of plansToCreate) {
      // 1. Find or create the equipment
      let equip = await prisma.equipment.findFirst({
        where: { nom: planData.nom, supermarketId: sm.id }
      });

      if (!equip) {
        equip = await prisma.equipment.create({
          data: {
            nom: planData.nom,
            supermarketId: sm.id,
            localisationId: defaultLoc?.id,
            active: true
          }
        });
      }

      // 2. Create the preventive plan
      const interval = getInterval(planData.periodiciteAn);
      
      await prisma.preventivePlan.create({
        data: {
          titre: `Maintenance Préventive - ${planData.nom}`,
          equipmentId: equip.id,
          intervalValue: interval.value,
          intervalUnit: interval.unit,
          prestataire: "ADIALEA", // as per the document
          active: true,
          nextDate: new Date(), // starting now for demo purposes
        }
      });
      
      totalPlans++;
    }
    
    console.log(`✓ Loaded ${plansToCreate.length} plans for ${sm.nom}`);
  }

  console.log(`✅ Done loading ${totalPlans} Preventive Plans 2026!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
