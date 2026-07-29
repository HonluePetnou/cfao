import * as xlsx from "xlsx";
import * as path from "path";

const filePath = path.resolve(__dirname, "../../../CHECK-LIST -SUNSHINE 001.xlsx");

const wb = xlsx.readFile(filePath);
console.log("Sheets:", wb.SheetNames);

wb.SheetNames.forEach((name) => {
  const ws = wb.Sheets[name];
  const rows: any[][] = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "" });
  console.log(`\n=== SHEET: ${name} (${rows.length} rows) ===`);
  rows.slice(0, 30).forEach((r, i) => {
    // Only show rows that have some content
    const hasContent = r.some(c => String(c).trim() !== "");
    if (hasContent) console.log(`  Row ${i}:`, JSON.stringify(r));
  });
});
