import { PrismaClient, Priority, TicketStatus } from "@prisma/client";
import * as xlsx from "xlsx";
import * as path from "path";

const prisma = new PrismaClient();

const filePath = path.resolve(__dirname, "../../../Suivi financier Maintenance _ juin 2026.xlsx");

// Helper to map SITE string to actual Supermarket Name
function getSupermarketName(siteName: string): string {
  const s = siteName.toUpperCase().trim();
  if (s.includes("BONABERI")) return "Carrefour Market Bonaberi";
  if (s.includes("BONAMOUSSADI")) return "Carrefour Market Bonamoussadi";
  if (s.includes("DALIP")) return "Carrefour Market Ancien Dalip";
  if (s.includes("AKWA-DUBAI") || s.includes("SUPECO")) return "Carrefour Market Akwa-Dubai";
  if (s.includes("LOGBOM") || s.includes("LOGPOM")) return "Carrefour Market Logbom";
  if (s.includes("WARDA")) return "Carrefour Market Warda"; // If it exists
  if (s.includes("EKIE")) return "Carrefour Market Ekie"; // If it exists
  return s; // Fallback
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
    // Excel date format (days since 1900)
    const date = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
    return date;
  }
  // Try JS parsing
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? undefined : d;
}

async function main() {
  console.log("Reading Excel file...", filePath);
  
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Read as raw array to handle merged header row
  const rawRows: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  
  // Find the row that contains "SITE" - that's our header row
  let headerRowIndex = -1;
  for (let i = 0; i < rawRows.length; i++) {
    if (rawRows[i] && rawRows[i].some(cell => String(cell).trim() === "SITE")) {
      headerRowIndex = i;
      break;
    }
  }
  
  if (headerRowIndex === -1) {
    console.error("Could not find header row! Exiting.");
    return;
  }
  
  const headers = rawRows[headerRowIndex].map(h => String(h || "").trim());
  console.log("Found headers at row", headerRowIndex + 1, ":", headers);
  
  // Convert remaining rows to objects
  const dataRows = rawRows.slice(headerRowIndex + 1);
  const data = dataRows
    .filter(row => row && row.some(cell => cell !== null && cell !== undefined && cell !== ""))
    .map(row => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });

  console.log(`Found ${data.length} data rows.`);
  if (data.length > 0) {
    console.log("First row:", data[0]);
  }

  // Load context
  const supermarkets = await prisma.supermarket.findMany();
  const allEquipments = await prisma.equipment.findMany({ include: { localisation: true } });

  // Ensure fallback equipment exists for each supermarket
  const fallbackEquipments = new Map<string, string>();
  for (const sm of supermarkets) {
    let fallback = await prisma.equipment.findFirst({
      where: { nom: "Équipement non spécifié (Import)", supermarketId: sm.id }
    });
    if (!fallback) {
      let loc = await prisma.localisation.findFirst({ where: { supermarketId: sm.id, nom: "Surface de Vente" } });
      if (!loc) loc = await prisma.localisation.findFirst({ where: { supermarketId: sm.id } });
      
      fallback = await prisma.equipment.create({
        data: {
          nom: "Équipement non spécifié (Import)",
          supermarketId: sm.id,
          localisationId: loc?.id,
        }
      });
    }
    fallbackEquipments.set(sm.id, fallback.id);
  }

  let imported = 0;
  let skipped = 0;

  for (const row of data) {
    const siteRaw = String(row["SITE"] || "").trim();
    if (!siteRaw || siteRaw === "SITE") continue; // Skip empty rows

    const smName = getSupermarketName(siteRaw);
    const sm = supermarkets.find(s => s.nom === smName);
    
    if (!sm) {
      console.log(`⚠️ Supermarket not found for SITE: "${siteRaw}". Skipping.`);
      skipped++;
      continue;
    }

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

    let priority: Priority = Priority.MOYENNE;
    if (criticiteStr.includes("HAUTE") || criticiteStr.includes("URGENT")) priority = Priority.HAUTE;
    if (criticiteStr.includes("FAIBLE") || criticiteStr.includes("BASSE")) priority = Priority.BASSE;

    // AI-like matching: Find best equipment
    // 1. Filter equipments for this supermarket
    const smEquipments = allEquipments.filter(e => e.supermarketId === sm.id);
    let matchedEquipId = fallbackEquipments.get(sm.id)!;

    // Very simple heuristic: search description for equipment name
    const descLower = description.toLowerCase();
    for (const eq of smEquipments) {
      const eqNom = eq.nom.toLowerCase();
      // Avoid matching generic small words, require at least 4 chars
      if (eqNom.length > 3 && (descLower.includes(eqNom) || eqNom.includes(descLower))) {
        matchedEquipId = eq.id;
        break;
      }
    }

    // Insert ticket
    await prisma.ticket.create({
      data: {
        titre: description.substring(0, 100), // Titre = first 100 chars of description
        description: `${description}\n\nEntreprise: ${entreprise}`,
        priority: priority,
        status: TicketStatus.FERME, // LOCKED
        equipmentId: matchedEquipId,
        // GMAO specific fields
        localisation: localisationStr,
        corpsEtat: corpsEtat,
        typeTravaux: typeTravaux,
        cout: montant,
        financement: financement,
        paiement: paiement,
        imputation: imputation,
        dateTermine: dateDepense || new Date(), // Using the expense date as termination date
        dateFerme: dateDepense || new Date(),
      }
    });

    imported++;
  }

  console.log(`✅ Successfully imported ${imported} tickets!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
