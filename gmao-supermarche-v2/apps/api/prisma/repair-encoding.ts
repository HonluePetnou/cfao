// Répare les textes corrompus par l'ancien bug d'encodage de restore-data.ps1
// (voir son historique git) : PowerShell 5.1 a restauré data/gmao-seed.sql en
// remplaçant chaque caractère accentué par un "?" littéral. Ce script compare
// les tables texte de la base réelle (schéma "public") à une copie propre du
// dump original chargée dans un schéma temporaire, et ne corrige QUE les
// lignes où la corruption est confirmée sans ambiguïté — jamais une valeur
// différente pour une autre raison (ex. un titre de ticket modifié depuis
// dans l'application), pour ne jamais écraser une vraie modification.
//
// Usage (depuis apps/api, DATABASE_URL pointant sur le schéma "public") :
//   1. Charger le dump original dans un schéma isolé :
//        docker compose exec -T postgres psql -U <user> -d <db> -c "CREATE SCHEMA IF NOT EXISTS repair_tmp;"
//        (voir scripts/repair-encoding.ps1 pour la commande complète)
//   2. npx ts-node prisma/repair-encoding.ts            # dry-run — affiche ce qui serait corrigé
//   3. npx ts-node prisma/repair-encoding.ts --apply    # applique réellement les corrections
//   4. docker compose exec -T postgres psql -U <user> -d <db> -c "DROP SCHEMA repair_tmp CASCADE;"

import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

const LIVE_URL = process.env.DATABASE_URL;
if (!LIVE_URL) {
  console.error("DATABASE_URL manquant.");
  process.exit(1);
}
const TMP_SCHEMA = process.env.REPAIR_TMP_SCHEMA || "repair_tmp";
const TMP_URL = withSchema(LIVE_URL, TMP_SCHEMA);

function withSchema(url: string, schema: string): string {
  const u = new URL(url);
  u.searchParams.set("schema", schema);
  return u.toString();
}

// Un caractère accentué corrompu devient un "?" (0x3F) littéral — on vérifie
// qu'en remplaçant chaque caractère non-ASCII de la version d'origine par
// "?", on retombe exactement sur la version actuelle en base. C'est la seule
// condition qui déclenche une correction.
function isConfirmedCorruption(original: string, current: string): boolean {
  if (original === current) return false;
  if (!current.includes("?")) return false;
  const collapsed = original.replace(/[^\x00-\x7F]/g, "?");
  return collapsed === current;
}

// Tables/colonnes texte susceptibles de contenir des caractères accentués,
// identifiées par un id cuid stable entre le dump original et la base live.
const TARGETS: { table: string; idField: string; textFields: string[] }[] = [
  { table: "supermarket", idField: "id", textFields: ["nom"] },
  { table: "localisation", idField: "id", textFields: ["nom"] },
  { table: "user", idField: "id", textFields: ["nom"] },
  { table: "equipment", idField: "id", textFields: ["nom", "description", "corpsEtat"] },
  { table: "ticket", idField: "id", textFields: ["titre", "description", "commentaireMaintenancier", "localisation"] },
  { table: "preventivePlan", idField: "id", textFields: ["titre", "checklist", "prestataire"] },
  { table: "preventiveTask", idField: "id", textFields: ["note"] },
  { table: "rapportJournalier", idField: "id", textFields: ["activites", "observations", "managerMaintenance"] },
  { table: "rondeJournaliere", idField: "id", textFields: ["observationsGenerales"] },
];

async function main() {
  const live = new PrismaClient({ datasources: { db: { url: LIVE_URL } } });
  const original = new PrismaClient({ datasources: { db: { url: TMP_URL } } });

  console.log(`Mode : ${APPLY ? "APPLICATION RÉELLE" : "DRY-RUN (aucune écriture)"}`);
  console.log(`Schéma temporaire attendu : ${TMP_SCHEMA}\n`);

  let totalFixed = 0;
  const report: string[] = [];

  for (const { table, idField, textFields } of TARGETS) {
    // @ts-ignore - accès dynamique au modèle Prisma par nom de table
    const liveModel = (live as any)[table];
    // @ts-ignore
    const originalModel = (original as any)[table];
    if (!liveModel || !originalModel) {
      console.warn(`Table inconnue du client Prisma, ignorée : ${table}`);
      continue;
    }

    const select: any = { [idField]: true };
    for (const f of textFields) select[f] = true;

    const [liveRows, originalRows] = await Promise.all([
      liveModel.findMany({ select }),
      originalModel.findMany({ select }),
    ]);

    const originalById = new Map(originalRows.map((r: any) => [r[idField], r]));

    for (const liveRow of liveRows) {
      const origRow: any = originalById.get(liveRow[idField]);
      if (!origRow) continue; // créé après le dump d'origine — rien à comparer

      const updates: Record<string, string> = {};
      for (const field of textFields) {
        const liveVal = liveRow[field];
        const origVal = origRow[field];
        if (typeof liveVal !== "string" || typeof origVal !== "string") continue;
        if (isConfirmedCorruption(origVal, liveVal)) {
          updates[field] = origVal;
        }
      }

      if (Object.keys(updates).length > 0) {
        totalFixed++;
        for (const [field, value] of Object.entries(updates)) {
          report.push(`${table}.${field} [${liveRow[idField]}] : "${liveRow[field]}" -> "${value}"`);
        }
        if (APPLY) {
          await liveModel.update({ where: { [idField]: liveRow[idField] }, data: updates });
        }
      }
    }
  }

  console.log(report.length ? report.join("\n") : "Aucune corruption confirmée détectée.");
  console.log(`\n${totalFixed} ligne(s) ${APPLY ? "corrigée(s)" : "à corriger (dry-run, relancer avec --apply)"}.`);

  await live.$disconnect();
  await original.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
