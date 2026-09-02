// Corrige les tickets dont `typeTravaux` contient le libellé humain
// ("Maint. Corrective", "Maint. Préventive", "Maint. Améliorative",
// "Travaux neufs") au lieu de la clé attendue par le backend et les KPI du
// dashboard (kpi.service.ts filtre sur "MAINT_CORRECTIVE"/"MAINT_
// PREVENTIVE"/"MAINT_AMELIORATIVE"/"TRAVAUX_NEUFS") - bug du formulaire
// apps/web/app/tickets/new/page.tsx (corrigé par ailleurs), qui envoyait le
// libellé brut. Ces tickets sont invisibles dans "Dépense par type de
// travaux" et les compteurs "Maint. Corrective"/"Maint. Préventive" du
// dashboard tant qu'ils gardent le mauvais format.
//
// Fait exprès en JS/Prisma plutôt qu'en SQL brut via psql : le texte
// contient des accents ("Préventive", "Améliorative"), et faire passer du
// SQL accentué à travers PowerShell -> docker compose exec -> psql s'est
// avéré peu fiable cette session (voir l'historique de repair-encoding.ps1).
// Node/Prisma géré nativement en UTF-8, aucun risque d'encodage ici.
//
// Usage (à l'intérieur du conteneur api, DATABASE_URL pointant sur le
// schéma "public" de la vraie base) :
//   npx ts-node prisma/fix-type-travaux.ts            # dry-run
//   npx ts-node prisma/fix-type-travaux.ts --apply     # applique réellement

import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

// Libellé humain (valeur bugguée) -> clé attendue par le backend.
const MAPPING: Record<string, string> = {
  "Maint. Corrective": "MAINT_CORRECTIVE",
  "Maint. Préventive": "MAINT_PREVENTIVE",
  "Maint. Améliorative": "MAINT_AMELIORATIVE",
  "Travaux neufs": "TRAVAUX_NEUFS",
};

async function main() {
  const prisma = new PrismaClient();

  console.log(`Mode : ${APPLY ? "APPLICATION RÉELLE" : "DRY-RUN (aucune écriture)"}\n`);

  let total = 0;
  for (const [wrong, correct] of Object.entries(MAPPING)) {
    const count = await prisma.ticket.count({ where: { typeTravaux: wrong } });
    if (count === 0) continue;
    total += count;
    console.log(`"${wrong}" -> "${correct}" : ${count} ticket(s)`);
    if (APPLY) {
      await prisma.ticket.updateMany({ where: { typeTravaux: wrong }, data: { typeTravaux: correct } });
    }
  }

  console.log(total ? "" : "Aucun ticket au mauvais format trouvé.");
  console.log(`\n${total} ticket(s) ${APPLY ? "corrigé(s)" : "à corriger (dry-run, relancer avec --apply)"}.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
