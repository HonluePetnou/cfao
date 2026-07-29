/**
 * Seed de données de test GMAO
 * Crée ~120 tickets réalistes répartis sur les 5 supermarchés existants
 * pour permettre la visualisation complète du dashboard.
 *
 * Usage: npx ts-node --skip-project prisma/seed-test-data.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CORPS_ETAT = [
  "Climatisation / Ventilation",
  "Electricite courant fort",
  "Electricite courant faible",
  "Equipement de production",
  "Froid alimentaire",
  "Genie civile / batiment",
  "Mecanique",
  "Moyens de secours",
  "Plomberie industriel",
  "Plomberie sanitaire",
];

const LOCALISATIONS = [
  "Boucherie", "Charcuterie", "Boulangerie", "Bureaux / Locaux sociaux",
  "Chambres Froides", "Exterieur / Parking", "Galerie marchande",
  "Locaux Techniques", "Meubles froids", "Patisserie",
  "Poissonerie", "Surface de Vente", "Reception", "Reserve",
];

const TYPES = ["MAINT_CORRECTIVE", "MAINT_CORRECTIVE", "MAINT_CORRECTIVE", "MAINT_PREVENTIVE", "MAINT_AMELIORATIVE", "TRAVAUX_NEUFS"];
const STATUSES = ["NOUVEAU", "ASSIGNE", "EN_COURS", "TERMINE", "FERME", "A_REPRENDRE"];
const PRIORITIES = ["BASSE", "MOYENNE", "HAUTE", "CRITIQUE"];
const FINANCEMENTS = ["CAPEX", "OPEX", "OPEX", "OPEX", "OPEX"]; // majorité OPEX comme le board

const TITRES_CORRECTIFS = [
  "Panne compresseur chambre froide", "Court-circuit tableau électrique",
  "Fuite circuit frigorifique", "Défaut démarrage groupe froid",
  "Panne moteur convoyeur", "Disjoncteur déclenché rayon boulangerie",
  "Clim en avarie bureau direction", "Fuite eau plafond réserve",
  "Panne groupe électrogène", "Défaut pesée balance boucherie",
  "Arrêt climatisation surface de vente", "Panne éclairage parking",
  "Pompe de relevage HS", "Détecteur incendie déclenché",
  "Problème dégivrage meuble froid", "Porte frigorifique défaillante",
];
const TITRES_PREVENTIFS = [
  "Entretien trimestriel clim", "Révision groupe froid N°1",
  "Nettoyage condenseurs chambres froides", "Vérification extincteurs",
  "Contrôle tableau électrique général", "Graissage convoyeurs boulangerie",
  "Maintenance préventive compresseurs", "Test groupe électrogène mensuel",
];
const TITRES_AUTRES = [
  "Remplacement éclairage LED parking", "Rénovation sols surface de vente",
  "Mise à niveau câblage informatique", "Installation nouveau meuble froid",
  "Travaux extension réserve", "Amélioration ventilation cuisine",
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min: number, max: number): number { return Math.round((Math.random() * (max - min) + min) * 100) / 100; }
function dateInPast(daysAgo: number): Date { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d; }

async function main() {
  // 1. Récupérer les entités existantes
  const supermarkets = await prisma.supermarket.findMany({ select: { id: true, nom: true } });
  if (supermarkets.length === 0) { console.error("❌ Aucun supermarché en base."); process.exit(1); }

  const equipments = await prisma.equipment.findMany({ select: { id: true, nom: true, supermarketId: true } });
  if (equipments.length === 0) { console.error("❌ Aucun équipement en base. Créez des équipements d'abord."); process.exit(1); }

  const users = await prisma.user.findMany({ select: { id: true, role: true } });
  const maintenanciers = users.filter((u) => u.role === "MAINTENANCIER");
  const admins = users.filter((u) => u.role === "SUPER_ADMIN");

  console.log(`\n📦 Données existantes:`);
  console.log(`  ${supermarkets.length} supermarché(s)`);
  console.log(`  ${equipments.length} équipement(s)`);
  console.log(`  ${maintenanciers.length} maintenancier(s)`);

  // 2. Supprimer les tickets de test existants (pour éviter les doublons)
  const deleted = await prisma.ticket.deleteMany({
    where: { titre: { contains: "[TEST]" } },
  });
  if (deleted.count > 0) console.log(`\n🗑️  Supprimé ${deleted.count} ticket(s) de test précédents`);

  // 3. Créer les tickets
  const tickets: any[] = [];
  const totalTickets = 120;

  for (let i = 0; i < totalTickets; i++) {
    const daysAgo = rand(1, 180); // sur les 6 derniers mois
    const typeTravaux = pick(TYPES);
    const isCorrective = typeTravaux === "MAINT_CORRECTIVE";
    const isPreventive = typeTravaux === "MAINT_PREVENTIVE";

    // Associer à un équipement d'un supermarché existant
    const eq = pick(equipments);

    // Titre réaliste selon type
    const titre = `[TEST] ${isCorrective ? pick(TITRES_CORRECTIFS) : isPreventive ? pick(TITRES_PREVENTIFS) : pick(TITRES_AUTRES)}`;
    const status = pick(STATUSES);
    const priority = isCorrective ? (Math.random() > 0.6 ? "HAUTE" : Math.random() > 0.5 ? "CRITIQUE" : "MOYENNE") : pick(PRIORITIES);
    const financement = pick(FINANCEMENTS);

    // tempsArret en heures — seulement pour correctif avec panne réelle
    const hasPanne = isCorrective && Math.random() > 0.3;
    const tempsArret = hasPanne ? randFloat(0.25, 24) : 0;

    // Coût selon type
    const cout = Math.random() > 0.15 ? (
      isCorrective ? rand(50000, 1500000) :
      isPreventive ? rand(20000, 300000) :
      rand(100000, 5000000)
    ) : null;

    const createdAt = dateInPast(daysAgo);
    const isTermine = ["TERMINE", "FERME"].includes(status);

    // Dates workflow
    const dateAssigned = status !== "NOUVEAU" ? new Date(createdAt.getTime() + rand(1, 48) * 3600000) : null;
    const dateEnCours = ["EN_COURS", "TERMINE", "FERME"].includes(status) ? new Date((dateAssigned?.getTime() ?? createdAt.getTime()) + rand(1, 24) * 3600000) : null;
    const dateTermine = isTermine ? new Date((dateEnCours?.getTime() ?? createdAt.getTime()) + rand(1, 72) * 3600000) : null;
    const dateFerme = status === "FERME" ? new Date((dateTermine?.getTime() ?? createdAt.getTime()) + rand(1, 48) * 3600000) : null;

    tickets.push({
      titre,
      description: `Intervention ${typeTravaux.replace("_", " ").toLowerCase()} — Zone ${pick(LOCALISATIONS)}`,
      priority,
      status,
      equipmentId: eq.id,
      typeTravaux,
      corpsEtat: pick(CORPS_ETAT),
      localisation: pick(LOCALISATIONS),
      cout,
      tempsArret,
      financement,
      paiement: financement === "OPEX" ? "Bon de commande" : "Contrat",
      createdAt,
      updatedAt: dateTermine ?? dateEnCours ?? dateAssigned ?? createdAt,
      dateAssigned,
      dateEnCours,
      dateTermine,
      dateFerme,
      ...(maintenanciers.length > 0 && status !== "NOUVEAU"
        ? { assignedMaintenancierId: pick(maintenanciers).id }
        : {}),
      ...(admins.length > 0 && status === "FERME"
        ? { closedById: pick(admins).id }
        : {}),
    });
  }

  // Insérer par batch
  let created = 0;
  const BATCH = 20;
  for (let i = 0; i < tickets.length; i += BATCH) {
    const batch = tickets.slice(i, i + BATCH);
    for (const t of batch) {
      await prisma.ticket.create({ data: t });
      created++;
    }
    process.stdout.write(`\r  📝 Créé ${created}/${totalTickets} tickets...`);
  }

  // 4. Résumé
  const summary = await prisma.ticket.groupBy({
    by: ["typeTravaux"],
    where: { titre: { contains: "[TEST]" } },
    _count: { id: true },
  });

  const totalCout = await prisma.ticket.aggregate({
    where: { titre: { contains: "[TEST]" }, cout: { not: null } },
    _sum: { cout: true },
  });

  console.log(`\n\n✅ Seed terminé !`);
  console.log(`\n📊 Répartition:`);
  summary.forEach((s) => console.log(`  ${s.typeTravaux || "Sans type"}: ${s._count.id} tickets`));
  console.log(`\n💰 Coût total: ${((totalCout._sum.cout ?? 0) / 1_000_000).toFixed(2)} M XAF`);
  console.log(`\n👉 Rechargez le dashboard pour voir les données !\n`);
}

main()
  .catch((e) => { console.error("\n❌ Erreur:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
