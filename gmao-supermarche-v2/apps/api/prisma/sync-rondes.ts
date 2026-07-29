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

const BONAMOUSSADI_EQUIPMENTS = [
    { secteur: "Boulangerie / Pâtisserie", nom: "Pétrin", marque: "VMI", modele: "SPI 220" },
    { secteur: "Boulangerie / Pâtisserie", nom: "Pétrin", marque: "VMI", modele: "SPI 63" },
    { secteur: "Boulangerie / Pâtisserie", nom: "Four ventilé", marque: "BONGARD", modele: "93120612" },
    { secteur: "Boulangerie / Pâtisserie", nom: "Four ventilé", marque: "BONGARD", modele: "93120612" },
    { secteur: "Cuisine / Restauration (Traiteur)", nom: "Four à vapeur", marque: "HOUNÖ", modele: "INJECT 1.10" },
    { secteur: "Cuisine / Restauration (Traiteur)", nom: "Friteuse électrique", marque: "FRYMASTER", modele: "FPRE117-21" },
    { secteur: "Boucherie / Charcuterie", nom: "Scie à os", marque: "DADAUX", modele: "SX350" },
    { secteur: "Boucherie / Charcuterie", nom: "Hachoir", marque: "DADAUX (CRYOLITE)", modele: "TX98DC AVEC SECU" },
    { secteur: "Boucherie / Charcuterie", nom: "Poussoir", marque: "DADAUX", modele: "PHX25" },
    { secteur: "Boucherie / Charcuterie", nom: "Mélangeur", marque: "DADAUX", modele: "PMX60" },
    { secteur: "Boucherie / Charcuterie", nom: "Chambre froide positive boucherie", modele: "MKC-NF-1135A" },
    { secteur: "Boucherie / Charcuterie", nom: "Chambre froide négative boucherie", modele: "MKC-NF-1135A" },
    { secteur: "Poissonnerie", nom: "Machine à glace", marque: "SCOTSMAN", modele: "MAR 106 AS" },
    { secteur: "Poissonnerie", nom: "Chambre froide positive" },
    { secteur: "Fruits & Légumes", nom: "Chambre froide positive" },
    { secteur: "Produits laitiers", nom: "Chambre froide positive" },
    { secteur: "Stock & Chambres froides", nom: "Chambre froide négative" },
    { secteur: "Caisse / Accueil", nom: "Climatiseur mural", marque: "GREE" },
    { secteur: "Caisse / Accueil", nom: "Rideau d'air" },
    { secteur: "Entrée / Caisses", nom: "Portique anti-vol" },
    { secteur: "Rayon produit laitier", nom: "Groupement de frigos n°1", marque: "EXHAL" },
    { secteur: "Rayon fruits et légumes", nom: "Maxi frigo", marque: "EXHAL" },
    { secteur: "Traiteur", nom: "Rôtissoire", marque: "DOREGRILL", modele: "NANTAISE RB24 NE" },
    { secteur: "Traiteur", nom: "Trancheuse halal", marque: "DIAMOND", modele: "GX5/300" },
    { secteur: "Traiteur", nom: "Trancheuse non halal", marque: "ABO", modele: "GX5/350" },
    { secteur: "Traiteur", nom: "Fourneau 4 plaques électriques", marque: "DIAMOND", modele: "E7/CUE14LE" },
    { secteur: "Atelier Stock", nom: "Presse à carton", modele: "COMPACTOR 3325" },
    { secteur: "IT", nom: "Onduleur", marque: "Schneider Electric" },
    { secteur: "Local photovoltaïque", nom: "Onduleur", marque: "Huawei" },
    { secteur: "Local chambres froides", nom: "Groupe centrale frigorifique", marque: "BOCK" },
];

const CORPS_ETAT_MAP: Record<string, string> = {
  "Boulangerie / Pâtisserie": "Mécanique",
  "Cuisine / Restauration (Traiteur)": "Électricité",
  "Boucherie / Charcuterie": "Mécanique",
  "Poissonnerie": "Froid",
  "Fruits & Légumes": "Froid",
  "Produits laitiers": "Froid",
  "Stock & Chambres froides": "Froid",
  "Caisse / Accueil": "Électricité",
  "Entrée / Caisses": "Électricité",
  "Rayon produit laitier": "Froid",
  "Rayon fruits et légumes": "Froid",
  "Traiteur": "Électricité",
  "Atelier Stock": "Mécanique",
  "IT": "Électricité",
  "Local photovoltaïque": "Électricité",
  "Local chambres froides": "Froid",
};

async function main() {
  const maintenancier = await prisma.user.findFirst({ where: { role: "MAINTENANCIER" } });
  if (!maintenancier) { console.error("No MAINTENANCIER found"); return; }

  const supermarkets = await prisma.supermarket.findMany();
  let equipmentCreated = 0;
  let plansCreated = 0;
  let tasksCreated = 0;

  for (const supermarket of supermarkets) {
    console.log(`\nSyncing for Supermarket: ${supermarket.nom} (${supermarket.code})`);

    // 1. Sync localisations and equipments (using BONAMOUSSADI as the model)
    const sectorNames = [...new Set(BONAMOUSSADI_EQUIPMENTS.map((e) => e.secteur))];
    const departments = new Map<string, string>();

    for (const sector of sectorNames) {
      let loc = await prisma.localisation.findFirst({
        where: { nom: sector, supermarketId: supermarket.id }
      });
      if (!loc) {
        loc = await prisma.localisation.create({
          data: { nom: sector, supermarketId: supermarket.id }
        });
      }
      departments.set(sector, loc.id);
    }

    for (const eq of BONAMOUSSADI_EQUIPMENTS) {
      const depId = departments.get(eq.secteur);
      if (!depId) continue;
      
      const description = [eq.marque, eq.modele].filter(Boolean).join(" / ");
      
      // Check if equipment already exists to avoid duplication
      const existingEq = await prisma.equipment.findFirst({
        where: { nom: eq.nom, supermarketId: supermarket.id, localisationId: depId }
      });

      if (!existingEq) {
        await prisma.equipment.create({
          data: {
            nom: eq.nom,
            description: description || null,
            supermarketId: supermarket.id,
            localisationId: depId,
            corpsEtat: CORPS_ETAT_MAP[eq.secteur] || null,
            criticite: "Normale"
          }
        });
        equipmentCreated++;
      }
    }

    // 2. Sync Preventive Plans
    const allEquips = await prisma.equipment.findMany({ 
        where: { supermarketId: supermarket.id },
        include: { supermarket: true } 
    });

    for (const cat of MAINT_CATEGORIES) {
      const matched = allEquips.filter((e) =>
        cat.keywords.some((kw) => e.nom.toLowerCase().includes(kw.toLowerCase()))
      );

      for (const equip of matched) {
        const existingPlan = await prisma.preventivePlan.findFirst({
          where: { equipmentId: equip.id, titre: { contains: cat.name } },
        });

        if (!existingPlan) {
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

          await prisma.preventiveTask.create({
            data: {
              planId: plan.id,
              dueDate: new Date(),
              status: "PLANIFIE",
            },
          });

          plansCreated++;
          tasksCreated++;
        }
      }
    }
  }

  console.log(`\n✅ Done syncing model Bonamoussadi across all supermarkets!`);
  console.log(`- ${equipmentCreated} equipments created`);
  console.log(`- ${plansCreated} preventive plans created`);
  console.log(`- ${tasksCreated} preventive tasks created`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
