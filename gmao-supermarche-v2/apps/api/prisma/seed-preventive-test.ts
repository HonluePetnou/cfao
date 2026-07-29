/**
 * Seed de données de test pour la Maintenance Préventive
 * Crée des plans préventifs et des tâches associées (historique, en retard, futures)
 *
 * Usage: npx ts-node --skip-project prisma/seed-preventive-test.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Initialisation des données de test de maintenance préventive...");

  // 1. Récupérer les entités existantes
  const equipments = await prisma.equipment.findMany({ select: { id: true, nom: true } });
  if (equipments.length === 0) {
    console.error("❌ Aucun équipement en base. Créez des équipements d'abord.");
    process.exit(1);
  }

  const users = await prisma.user.findMany({ where: { role: "MAINTENANCIER" }, select: { id: true } });
  const mainId = users[0]?.id || null;

  // 2. Nettoyer les anciens plans de test
  const deletedTasks = await prisma.preventiveTask.deleteMany({
    where: { plan: { titre: { contains: "[TEST]" } } }
  });
  const deletedPlans = await prisma.preventivePlan.deleteMany({
    where: { titre: { contains: "[TEST]" } }
  });
  console.log(`🗑️  Supprimé ${deletedPlans.count} plan(s) et ${deletedTasks.count} tâche(s) de test.`);

  // 3. Créer des plans réalistes
  const samplePlans = [
    {
      titre: "[TEST] Entretien climatisation bureaux",
      intervalValue: 3,
      intervalUnit: "MONTHS" as const,
      checklist: "Nettoyer les filtres à air\nVérifier le niveau de gaz réfrigérant\nTester la télécommande et le thermostat\nContrôler le drainage des condensats",
      nextDate: new Date("2026-08-15T08:00:00Z"),
    },
    {
      titre: "[TEST] Révision compresseur Froid Alimentaire",
      intervalValue: 30,
      intervalUnit: "DAYS" as const,
      checklist: "Vérifier la pression d'huile\nContrôler l'étanchéité des raccords\nMesurer l'intensité du moteur\nNettoyer le condenseur extérieur",
      nextDate: new Date("2026-07-25T08:00:00Z"),
    },
    {
      titre: "[TEST] Vérification annuelle TGBT",
      intervalValue: 1,
      intervalUnit: "YEARS" as const,
      checklist: "Resserrage des connexions borniers\nThermographie infrarouge des disjoncteurs\nContrôle de la mise à la terre\nTest des déclencheurs différentiels",
      nextDate: new Date("2026-12-01T08:00:00Z"),
    },
    {
      titre: "[TEST] Nettoyage Meubles Froids négatifs",
      intervalValue: 2,
      intervalUnit: "WEEKS" as const,
      checklist: "Vider le meuble et stocker en réserve froide\nDégivrer complètement l'évaporateur\nNettoyer les grilles de reprise d'air\nContrôler le cordon chauffant de porte",
      nextDate: new Date("2026-06-10T08:00:00Z"), // Échéance passée pour simuler une tâche EN_RETARD
    }
  ];

  let plansCreated = 0;
  let tasksCreated = 0;

  for (let i = 0; i < samplePlans.length; i++) {
    const pData = samplePlans[i];
    // Choisir des équipements différents si possible
    const eq = equipments[i % equipments.length];

    const plan = await prisma.preventivePlan.create({
      data: {
        titre: pData.titre,
        equipmentId: eq.id,
        intervalValue: pData.intervalValue,
        intervalUnit: pData.intervalUnit,
        checklist: pData.checklist,
        nextDate: pData.nextDate,
        assignedMaintenancierId: mainId,
        active: true,
      }
    });
    plansCreated++;

    // Pour chaque plan, créons :
    // - 1 tâche EFFECTUE dans le passé (historique)
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30);
    await prisma.preventiveTask.create({
      data: {
        planId: plan.id,
        dueDate: pastDate,
        status: "EFFECTUE",
        doneAt: new Date(pastDate.getTime() + 3600000), // Fait 1h après
        note: `[TEST OK] Toutes les opérations de la checklist ont été effectuées avec succès. Aucun défaut relevé sur l'appareil.`,
      }
    });
    tasksCreated++;

    // - 1 tâche active (PLANIFIE ou EN_RETARD)
    const isLate = pData.nextDate < new Date();
    await prisma.preventiveTask.create({
      data: {
        planId: plan.id,
        dueDate: pData.nextDate,
        status: isLate ? "EN_RETARD" : "PLANIFIE",
      }
    });
    tasksCreated++;
  }

  console.log(`\n✅ Données de test préventives générées !`);
  console.log(`   Plans créés : ${plansCreated}`);
  console.log(`   Tâches créées : ${tasksCreated}`);
  console.log(`   Maintenancier lié : ${mainId ? "Oui" : "Non (prestataires)"}`);
  console.log(`👉 Ouvrez la page "Plans préventifs" sur le frontend pour visualiser le calendrier !\n`);
}

main()
  .catch((e) => {
    console.error("❌ Erreur de génération des données préventives :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
