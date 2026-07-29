import { PrismaClient, PlanIntervalUnit } from "@prisma/client";

const prisma = new PrismaClient();

const MAINT_CATEGORIES: { name: string; keywords: string[]; interval: number; unit: PlanIntervalUnit }[] = [
  { name: "Groupe électrogène", keywords: ["groupe electrogene", "groupe électrogène"], interval: 30, unit: "DAYS" },
  { name: "AVR / Régulation", keywords: ["avr", "regul"], interval: 30, unit: "DAYS" },
  { name: "Onduleur / UPS", keywords: ["onduleur", "ups"], interval: 30, unit: "DAYS" },
  { name: "Transformateur", keywords: ["transformateur", "local transformateur", "tgbt"], interval: 30, unit: "DAYS" },
  { name: "Batterie de compensation", keywords: ["batterie", "compensation"], interval: 30, unit: "DAYS" },
  { name: "SSI / Sécurité incendie", keywords: ["ssi", "securite incendie", "ria"], interval: 30, unit: "DAYS" },
  { name: "Anti-intrusion", keywords: ["anti-intrusion", "alarme"], interval: 30, unit: "DAYS" },
  { name: "Porte vitrée / accès", keywords: ["porte vire", "porte", "portique"], interval: 30, unit: "DAYS" },
  { name: "Climatisation Rooftop", keywords: ["rooftop", "climatisation rooftop"], interval: 30, unit: "DAYS" },
  { name: "Split / Rideau d'air", keywords: ["split", "rideau d'air", "climatisateur"], interval: 30, unit: "DAYS" },
  { name: "Ventilation / Extraction", keywords: ["ventilat", "extracteur", "ventilation"], interval: 30, unit: "DAYS" },
  { name: "Surpresseur / AEP / RIA", keywords: ["surpresseur", "aep", "ria", "eau"], interval: 30, unit: "DAYS" },
  { name: "Chambre froide négative", keywords: ["chambre froide neg", "chambre froide négative"], interval: 15, unit: "DAYS" },
  { name: "Chambre froide positive", keywords: ["chambre froide pos"], interval: 15, unit: "DAYS" },
  { name: "Centrale négative", keywords: ["centrale neg"], interval: 15, unit: "DAYS" },
  { name: "Centrale positive", keywords: ["centrale pos"], interval: 30, unit: "DAYS" },
  { name: "Meuble frigorifique", keywords: ["meuble neg", "meuble surgel", "meuble fri"], interval: 15, unit: "DAYS" },
  { name: "Four / Cuisson", keywords: ["four", "cuisinire"], interval: 15, unit: "DAYS" },
  { name: "Pétrin", keywords: ["ptrin", "petrin"], interval: 15, unit: "DAYS" },
  { name: "Balance", keywords: ["balance"], interval: 30, unit: "DAYS" },
  { name: "Hachoir", keywords: ["hachoir"], interval: 15, unit: "DAYS" },
  { name: "Trancheuse", keywords: ["trancheuse", "scie"], interval: 15, unit: "DAYS" },
  { name: "Presse à balle", keywords: ["presse balle"], interval: 30, unit: "DAYS" },
  { name: "Groupe de condensation", keywords: ["groupe condense"], interval: 30, unit: "DAYS" },
];

async function main() {
  const maintenancier = await prisma.user.findFirst({ where: { role: "MAINTENANCIER" } });
  if (!maintenancier) { console.error("No MAINTENANCIER found"); return; }

  const allEquips = await prisma.equipment.findMany({ include: { supermarket: true } });
  let planCount = 0;
  let taskCount = 0;

  for (const cat of MAINT_CATEGORIES) {
    // Find matching equipment
    const matched = allEquips.filter((e) =>
      cat.keywords.some((kw) => e.nom.toLowerCase().includes(kw.toLowerCase()))
    );

    if (matched.length === 0) {
      console.log(`  SKIP: no equipment matches "${cat.name}"`);
      continue;
    }

    for (const equip of matched) {
      const existing = await prisma.preventivePlan.findFirst({
        where: { equipmentId: equip.id, titre: { contains: cat.name } },
      });
      if (existing) {
        console.log(`  EXISTS: ${cat.name} -> ${equip.nom} (${equip.supermarket.code})`);
        continue;
      }

      const plan = await prisma.preventivePlan.create({
        data: {
          titre: cat.name,
          equipmentId: equip.id,
          intervalValue: cat.interval,
          intervalUnit: cat.unit,
          assignedMaintenancierId: maintenancier.id,
          nextDate: new Date(),
          checklist: JSON.stringify(getChecklistByCategory(cat.name)),
        },
      });

      // Create current month task
      const task = await prisma.preventiveTask.create({
        data: {
          planId: plan.id,
          dueDate: new Date(),
          status: "PLANIFIE",
        },
      });

      planCount++;
      taskCount++;
      console.log(`  CREATED: ${cat.name} -> ${equip.nom} (${equip.supermarket.code})`);
    }
  }

  console.log(`\n✅ ${planCount} plans and ${taskCount} tasks created!`);
}

function getChecklistByCategory(catName: string): string[] {
  const generic = [
    "Inspection visuelle générale",
    "Vérification des fixations",
    "Nettoyage",
  ];
  const checklists: Record<string, string[]> = {
    "Chambre froide négative": [
      "Nettoyage du givre sur évaporateur",
      "Vérification température de consigne",
      "Contrôle joint de porte",
      "Nettoyage condenseur",
    ],
    "Chambre froide positive": [
      "Nettoyage évaporateur",
      "Vérification température",
      "Contrôle joint de porte",
      "Nettoyage condenseur",
    ],
    "Centrale négative": [
      "Vérification niveau huile compresseur",
      "Contrôle pressostats",
      "Nettoyée condenseur",
      "Vérification ventilation",
    ],
    "Centrale positive": [
      "Vérification niveau huile compresseur",
      "Contrôle pressostats",
      "Nettoyée condenseur",
    ],
    "Climatisation Rooftop": [
      "Nettoyage filtres",
      "Vérification pression gaz",
      "Contrôle ventilation",
      "Nettoyage condenseur",
    ],
    "Split / Rideau d'air": [
      "Nettoyage filtres",
      "Vérification drainage condensats",
      "Contrôle température départ/retour",
    ],
    "Groupe électrogène": [
      "Vérification niveau huile",
      "Vérification niveau carburant",
      "Vérification liquide refroidissement",
      "Test démarrage automatique",
    ],
    "Pétrin": [
      "Graissage des roulements",
      "Contrôle courroie",
      "Nettoyage général",
    ],
    "Four / Cuisson": [
      "Vérification résistances chauffantes",
      "Contrôle sonde de température",
      "Nettoyage intérieur et extérieur",
    ],
  };
  return checklists[catName] || generic;
}

main().catch(console.error).finally(() => prisma.$disconnect());
