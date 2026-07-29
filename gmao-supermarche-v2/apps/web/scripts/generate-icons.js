/**
 * Script de génération des icônes PWA pour GMAO
 * 
 * Usage: node scripts/generate-icons.js
 * Prérequis: npm install -D sharp (à lancer depuis apps/web)
 * 
 * Ce script génère toutes les tailles d'icônes nécessaires pour la PWA
 * à partir du fichier public/icons/icon.svg
 */

const path = require("path");
const fs = require("fs");

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const SRC = path.join(__dirname, "../public/icons/icon.svg");
const OUT = path.join(__dirname, "../public/icons");

async function generate() {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    console.error("❌ 'sharp' n'est pas installé.");
    console.error("   Lancez : npm install -D sharp");
    process.exit(1);
  }

  if (!fs.existsSync(SRC)) {
    console.error("❌ Fichier source introuvable :", SRC);
    process.exit(1);
  }

  console.log("🎨 Génération des icônes PWA GMAO...\n");

  for (const size of SIZES) {
    const outPath = path.join(OUT, `icon-${size}x${size}.png`);
    await sharp(SRC)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`  ✅ icon-${size}x${size}.png`);
  }

  // Favicon
  const faviconPath = path.join(__dirname, "../public/favicon.ico");
  await sharp(SRC).resize(32, 32).png().toFile(
    path.join(OUT, "favicon-32.png")
  );
  console.log("  ✅ favicon-32.png");

  // Apple touch icon
  await sharp(SRC).resize(180, 180).png().toFile(
    path.join(OUT, "apple-touch-icon.png")
  );
  console.log("  ✅ apple-touch-icon.png");

  console.log("\n🚀 Toutes les icônes ont été générées dans public/icons/");
}

generate().catch(console.error);
