import { PrismaClient } from "@prisma/client";
import * as xlsx from "xlsx";
import * as path from "path";

const prisma = new PrismaClient();
const filePath = path.resolve(__dirname, "../../../data/Suivi financier Maintenance _ juin 2026.xlsx");

// Only these sites were SKIPPED — we create them and import their tickets
const MISSING_SITES_MAP: Record<string, string> = {
  "WARDA":            "Carrefour Market Warda",
  "EKIE":             "Carrefour Market Ekie",
  "ENTREPOT":         "Entrepôt CFAO",
  "DOMICILES EXPATS": "Domiciles Expats CFAO",
  "BU BALI":          "BU Bali CFAO",
};

function getSupermarketName(siteName: string): string | null {
  const s = siteName.toUpperCase().trim();
  for (const [key, val] of Object.entries(MISSING_SITES_MAP)) {
    if (s.includes(key)) return val;
  }
  return null; // Only handle the missing sites in this script
}

function parseMontant(montantStr: any): number {
  if (!montantStr) return 0;
  if (typeof montantStr === "number") return montantStr;
  const cleaned = String(montantStr).replace(/[^0-9.-]+/g, "");
  return parseFloat(cleaned) || 0;
}

function parseDate(dateStr: any): Date | undefined {
  if (!dateStr) return undefined;
  if (typeof dateStr === "number") {
    return new Date(Math.round((dateStr - 25569) * 86400 * 1000));
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? undefined : d;
}

async function main() {
  console.log("Reading Excel file:", filePath);
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

  // Find header row
  let headerRowIndex = -1;
  for (let i = 0; i < rawRows.length; i++) {
    if (rawRows[i]?.some(cell => String(cell).trim() === "SITE")) {
      headerRowIndex = i;
      break;
    }
  }
  if (headerRowIndex === -1) { console.error("Header row not found!"); return; }

  const headers = rawRows[headerRowIndex].map(h => String(h || "").trim());
  const dataRows = rawRows.slice(headerRowIndex + 1)
    .filter(row => row?.some(cell => cell !== null && cell !== undefined && cell !== ""))
    .map(row => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });

  console.log(`Total rows in file: ${dataRows.length}`);

  // --- Step 1: Create the missing supermarkets if they don't exist ---
  const createdSupermarkets: Record<string, string> = {}; // name -> id

  for (const smName of Object.values(MISSING_SITES_MAP)) {
    let sm = await prisma.supermarket.findFirst({ where: { nom: smName } });
    if (!sm) {
      // Generate a simple unique code from the name
      const code = smName.toUpperCase().replace(/[^A-Z0-9]/g, "_").substring(0, 20) + "_" + Date.now().toString().slice(-4);
      sm = await prisma.supermarket.create({ data: { nom: smName, code } });
      console.log(`✅ Created supermarket: ${smName} (code: ${code})`);
    } else {
      console.log(`ℹ️  Supermarket already exists: ${smName}`);
    }
    createdSupermarkets[smName] = sm.id;
  }

  // --- Step 2: Ensure fallback equipment exists for each ---
  const fallbackEquipments = new Map<string, string>();
  for (const [smName, smId] of Object.entries(createdSupermarkets)) {
    let loc = await prisma.localisation.findFirst({ where: { supermarketId: smId } });
    if (!loc) {
      loc = await prisma.localisation.create({
        data: { nom: "Surface de Vente", supermarketId: smId }
      });
      console.log(`  ↳ Created default localisation for ${smName}`);
    }
    let fallback = await prisma.equipment.findFirst({
      where: { nom: "Équipement non spécifié (Import)", supermarketId: smId }
    });
    if (!fallback) {
      fallback = await prisma.equipment.create({
        data: { nom: "Équipement non spécifié (Import)", supermarketId: smId, localisationId: loc.id }
      });
    }
    fallbackEquipments.set(smId, fallback.id);
  }

  // --- Step 3: Import tickets for these sites ONLY ---
  let imported = 0;
  let skippedOtherSites = 0;

  for (const row of dataRows) {
    const siteRaw = String(row["SITE"] || "").trim();
    if (!siteRaw || siteRaw === "SITE") continue;

    const smName = getSupermarketName(siteRaw);
    if (!smName) {
      // This row belongs to an already-imported site — skip
      skippedOtherSites++;
      continue;
    }

    const smId = createdSupermarkets[smName];
    if (!smId) continue;

    const description = String(row["DESCRIPTION DES TRAVAUX / PANNES"] || "Sans description");
    const localisationStr = String(row["LOCALISATION"] || "");
    const corpsEtat = String(row["CORPS D'ETAT"] || row["CORPS D'ET."] || "");
    const typeTravaux = String(row["TYPES DE TRAVAUX"] || "");
    const montant = parseMontant(row["MONTANT"]);
    const criticiteStr = String(row["CRITICITE"] || "").toUpperCase();
    const financement = String(row["NATURE DU FINANCEMENT (CAPEX/OPEX)"] || row["NATURE DU FINANCEMENT"] || "");
    const paiement = String(row["GESTION DU PAIEMENT"] || row["GESTION PAIEMENT"] || "");
    const dateDepense = parseDate(row["DATE DE DEPENSE / PROVISION"] || row["DATE DE DEPENSE PROVIS."]);
    const entreprise = String(row["ENTREPRISES"] || "ADIALEA");
    const imputation = String(row["IMPUTATION"] || "");

    let priority: any = "MOYENNE";
    if (criticiteStr.includes("HAUTE") || criticiteStr.includes("URGENT")) priority = "HAUTE";
    if (criticiteStr.includes("FAIBLE") || criticiteStr.includes("BASSE")) priority = "BASSE";

    const equipId = fallbackEquipments.get(smId)!;

    await prisma.ticket.create({
      data: {
        titre: description.substring(0, 100),
        description: `${description}\n\nEntreprise: ${entreprise}`,
        priority,
        status: "FERME",
        equipmentId: equipId,
        localisation: localisationStr,
        corpsEtat,
        typeTravaux,
        cout: montant,
        financement,
        paiement,
        imputation,
        dateTermine: dateDepense || new Date(),
        dateFerme: dateDepense || new Date(),
      }
    });
    imported++;
    process.stdout.write(`\r  → Imported: ${imported}`);
  }

  console.log(`\n\n✅ Done! Imported ${imported} new tickets for the 5 missing sites.`);
  console.log(`   (${skippedOtherSites} rows from already-imported sites were correctly skipped)`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
