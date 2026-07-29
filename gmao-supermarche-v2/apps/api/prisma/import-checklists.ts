import { PrismaClient } from "@prisma/client";
import * as xlsx from "xlsx";
import * as path from "path";

const prisma = new PrismaClient();
const filePath = path.resolve(__dirname, "../../../CHECK-LIST -SUNSHINE 001.xlsx");

// Extract machine name from row 7 (e.g. "Machine : FACONNEUSE " → "FACONNEUSE")
function extractMachineName(rows: any[][]): string {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const row = rows[i];
    for (const cell of row) {
      const s = String(cell || "").trim();
      const match = s.match(/^Machine\s*:\s*(.+)/i);
      if (match) return match[1].trim().toUpperCase();
    }
  }
  return "";
}

// Section headers that mark a group of tasks (left or right column)
const SECTION_HEADERS = [
  "préparations chantier", "préparations", "actions nécessaires",
  "nettoyages", "nettoyage",
  "circuit électrique", "taches électriques", "taches de nettoyages et vérifications",
  "autres",
];

function isSectionHeader(cell: string): string | null {
  const s = cell.trim().toLowerCase();
  for (const h of SECTION_HEADERS) {
    if (s === h || s.startsWith(h)) return cell.trim();
  }
  return null;
}

function isTableHeader(row: any[]): boolean {
  const vals = row.map((c: any) => String(c || "").trim().toUpperCase());
  // Header rows contain "TACHES", "OUI", "NON", "AA", "AC", "ANC", "MM"
  return vals.some(v => v === "TACHES") && (vals.includes("OUI") || vals.includes("AA"));
}

function extractTasksFromSheet(rows: any[][]): { section: string; tache: string }[] {
  const tasks: { section: string; tache: string }[] = [];
  let leftSection = "Général";
  let rightSection = "Général";

  for (const row of rows) {
    if (!row || row.every((c: any) => String(c || "").trim() === "")) continue;

    const col0 = String(row[0] || "").trim();
    const col5 = String(row[5] || "").trim();

    // Skip table header rows (Taches / OUI / NON / AA / AC...)
    if (isTableHeader(row)) continue;

    // Detect section headers (col 0 = left section, col 5 = right section)
    const leftSec = col0 ? isSectionHeader(col0) : null;
    const rightSec = col5 ? isSectionHeader(col5) : null;

    if (leftSec) { leftSection = leftSec; }
    if (rightSec) { rightSection = rightSec; }

    // Extract task from left side (col 0), must be a real task (not section header, not empty, not meta)
    if (
      col0 &&
      !leftSec &&
      !col0.toLowerCase().startsWith("date") &&
      !col0.toLowerCase().startsWith("site") &&
      !col0.toLowerCase().startsWith("machine") &&
      !col0.toLowerCase().startsWith("n° de série") &&
      !col0.toLowerCase().startsWith("observation") &&
      !col0.toLowerCase().startsWith("visa") &&
      col0.length > 4
    ) {
      tasks.push({ section: leftSection, tache: col0 });
    }

    // Extract task from right side (col 5), same rules
    if (
      col5 &&
      !rightSec &&
      !col5.toLowerCase().startsWith("date") &&
      !col5.toLowerCase().startsWith("site") &&
      !col5.toLowerCase().startsWith("machine") &&
      !col5.toLowerCase().startsWith("n° de série") &&
      !col5.toLowerCase().startsWith("observation") &&
      !col5.toLowerCase().startsWith("visa") &&
      col5.length > 4
    ) {
      tasks.push({ section: rightSection, tache: col5 });
    }
  }

  return tasks;
}

// Fuzzy match: check if equipment name matches machine name from checklist
function equipmentMatchesMachine(equipNom: string, machineName: string): boolean {
  const eq = equipNom.toLowerCase().replace(/[^a-zàâéèêëîïôùûüç ]/gi, " ").trim();
  const mach = machineName.toLowerCase().replace(/[^a-zàâéèêëîïôùûüç ]/gi, " ").trim();

  // Direct contains
  if (eq.includes(mach) || mach.includes(eq)) return true;

  // Word overlap: at least 1 significant word in common (>= 4 chars)
  const eqWords = eq.split(/\s+/).filter(w => w.length >= 4);
  const machWords = mach.split(/\s+/).filter(w => w.length >= 4);
  return eqWords.some(w => machWords.includes(w));
}

async function main() {
  console.log("📂 Reading:", filePath);
  const wb = xlsx.readFile(filePath);

  // Load ALL preventive plans with their equipment
  const plans = await prisma.preventivePlan.findMany({
    include: { equipment: { select: { id: true, nom: true, supermarketId: true } } },
  });
  console.log(`📋 Found ${plans.length} PreventivePlans in DB\n`);

  let updatedPlans = 0;
  let skippedSheets = 0;
  const matchLog: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows: any[][] = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "" });

    const machineName = extractMachineName(rows);
    if (!machineName) {
      console.log(`⚠️  Sheet "${sheetName}": cannot extract machine name. Skipping.`);
      skippedSheets++;
      continue;
    }

    const tasks = extractTasksFromSheet(rows);
    if (tasks.length === 0) {
      console.log(`⚠️  Sheet "${sheetName}" (${machineName}): no tasks found. Skipping.`);
      skippedSheets++;
      continue;
    }

    // Find matching plans
    const matchingPlans = plans.filter(p => equipmentMatchesMachine(p.equipment.nom, machineName));

    if (matchingPlans.length === 0) {
      console.log(`❌  Sheet "${sheetName}" (${machineName}): no matching plan found.`);
      matchLog.push(`NO MATCH: ${machineName}`);
      skippedSheets++;
      continue;
    }

    // Format checklist as JSON: [{ section, taches: string[] }]
    const grouped: Record<string, string[]> = {};
    for (const t of tasks) {
      if (!grouped[t.section]) grouped[t.section] = [];
      // Avoid duplicates within section
      if (!grouped[t.section].includes(t.tache)) {
        grouped[t.section].push(t.tache);
      }
    }
    const checklist = JSON.stringify(
      Object.entries(grouped).map(([section, taches]) => ({ section, taches }))
    );

    // Update all matching plans
    for (const plan of matchingPlans) {
      await prisma.preventivePlan.update({
        where: { id: plan.id },
        data: { checklist },
      });
      console.log(`✅  "${machineName}" → Plan "${plan.titre}" (${plan.equipment.nom}) — ${tasks.length} tâches`);
      matchLog.push(`MATCHED: ${machineName} → ${plan.equipment.nom} (${tasks.length} tâches)`);
      updatedPlans++;
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`✅ Done! Updated ${updatedPlans} PreventivePlans.`);
  console.log(`⚠️  Skipped ${skippedSheets} sheets (no match or no tasks).`);
  console.log(`\nMatch Log:`);
  matchLog.forEach(l => console.log("  " + l));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
