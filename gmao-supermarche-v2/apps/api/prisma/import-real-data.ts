import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SITES = [
  { code: "BONAMOUSSADI", nom: "Carrefour Market Bonamoussadi" },
  { code: "BONABERI", nom: "Carrefour Market Bonaberi" },
  { code: "AKWA_DUBAI", nom: "Carrefour Market Akwa-Dubai" },
  { code: "ANCIEN_DALIP", nom: "Carrefour Market Ancien Dalip" },
  { code: "LOGPOM", nom: "Carrefour Market Logbom" },
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
  "Atelier Stock": "Mécanique",
  "IT": "Électricité",
  "Local photovoltaïque": "Électricité",
  "Local chambres froides": "Froid",
  "Compartiment froid": "Froid",
  "Toilettes": "Plomberie",
  "Froid alimentaire": "Froid",
  "Équipements de Production": "Mécanique",
  "Électricité": "Électricité",
  "Climatisation / Ventilation": "Froid",
  "Génie Civil / Bâtiment": "Génie Civil",
  "Plomberie": "Plomberie",
  "Mécanique": "Mécanique",
  "Moyens de secours": "Électricité",
  "Bureaux / Locaux sociaux": "Génie Civil",
  "Surface de Vente": "Génie Civil",
  "Extérieur / Parking": "Génie Civil",
  "Boucherie": "Mécanique",
  "Traiteur": "Électricité",
};

// Standard departments shared across sites
const STANDARD_DEPARTMENTS = [
  "Boulangerie / Pâtisserie",
  "Cuisine / Restauration (Traiteur)",
  "Boucherie / Charcuterie",
  "Poissonnerie",
  "Fruits & Légumes",
  "Produits laitiers",
  "Stock & Chambres froides",
  "Caisse / Accueil",
  "Entrée / Caisses",
  "Rayon produit laitier",
  "Rayon fruits et légumes",
  "Atelier Stock",
  "IT",
  "Local photovoltaïque",
  "Local chambres froides",
  "Compartiment froid",
  "Toilettes",
  "Froid alimentaire",
  "Équipements de Production",
  "Électricité",
  "Climatisation / Ventilation",
  "Génie Civil / Bâtiment",
  "Plomberie",
  "Mécanique",
  "Moyens de secours",
  "Bureaux / Locaux sociaux",
  "Surface de Vente",
  "Extérieur / Parking",
];

// Equipment by site (secteur -> equipment list)
const EQUIPMENT_BY_SITE: Record<string, Array<{ secteur: string; nom: string; marque?: string; modele?: string; quantite?: number }>> = {
  BONAMOUSSADI: [
    { secteur: "Boulangerie / Pâtisserie", nom: "Pétrin de la viennoiserie", marque: "BONGARD" },
    { secteur: "Boulangerie / Pâtisserie", nom: "Pétrin standard (grand pétrin)", marque: "BONGARD", modele: "SPIRAL EVO 150 M" },
    { secteur: "Boulangerie / Pâtisserie", nom: "Four à sol", marque: "BONGARD", modele: "OMEGA" },
    { secteur: "Boulangerie / Pâtisserie", nom: "Four à sol 2", marque: "BONGARD", modele: "OMEGA" },
    { secteur: "Boulangerie / Pâtisserie", nom: "Trancheuse à pain", marque: "ROLLMATIC", modele: "C42-5/13" },
    { secteur: "Boulangerie / Pâtisserie", nom: "Fermenteuse / chambre de pousse 1", marque: "BONGARD" },
    { secteur: "Boulangerie / Pâtisserie", nom: "Fermenteuse / chambre de pousse 2", marque: "BONGARD" },
    { secteur: "Boulangerie / Pâtisserie", nom: "Diviseuse", marque: "BONGARD", modele: "MIRA 3/400V/N+T" },
    { secteur: "Boulangerie / Pâtisserie", nom: "Façonneuse" },
    { secteur: "Boulangerie / Pâtisserie", nom: "Friteuse électrique", modele: "FR-24 K" },
    { secteur: "Boulangerie / Pâtisserie", nom: "Filmeuse", marque: "CCM", modele: "PFE 1101" },
    { secteur: "Cuisine / Restauration (Traiteur)", nom: "Cuisinière électrique (four 4 feux)", marque: "DIAMOND", modele: "E7/CUE14LE" },
    { secteur: "Cuisine / Restauration (Traiteur)", nom: "Friteuse électrique", marque: "L2G", modele: "EZ/FRE2V17" },
    { secteur: "Cuisine / Restauration (Traiteur)", nom: "Robot mixeur" },
    { secteur: "Cuisine / Restauration (Traiteur)", nom: "Robot coupe-légumes", marque: "SARO", modele: "CL 50 ULTRAL (CHEF 300)" },
    { secteur: "Cuisine / Restauration (Traiteur)", nom: "Four à pizza", modele: "366-1010" },
    { secteur: "Cuisine / Restauration (Traiteur)", nom: "Machine à kebab (rôtissoire)", marque: "DOREGRILL", modele: "NANTAISE RB24 NE" },
    { secteur: "Cuisine / Restauration (Traiteur)", nom: "Frigo vitrine réfrigérée libre-service", marque: "EXKAL", modele: "000013031" },
    { secteur: "Cuisine / Restauration (Traiteur)", nom: "Meuble présentoir chaud (poulet chaud)", modele: "V110LS" },
    { secteur: "Cuisine / Restauration (Traiteur)", nom: "Meuble cave / vitrine sandwich froid", marque: "DOREGRILL", modele: "MR120 STATIQUE" },
    { secteur: "Cuisine / Restauration (Traiteur)", nom: "Opéculeuse à barquette / thermo-soudeuse", marque: "BEFOR TECHNITRANS", modele: "TS200 (SP352)" },
    { secteur: "Boucherie / Charcuterie", nom: "Filmeuse", marque: "BEFOR TECHNITRANS", modele: "PFE 1101" },
    { secteur: "Boucherie / Charcuterie", nom: "Sous-videuse", marque: "BEFOR TECHNITRANS", modele: "SVJ 420" },
    { secteur: "Boucherie / Charcuterie", nom: "Râpe à fromage", marque: "SANTOS", modele: "Type 02" },
    { secteur: "Boucherie / Charcuterie", nom: "Trancheuse n°1", marque: "DIAMOND", modele: "GX5/300" },
    { secteur: "Boucherie / Charcuterie", nom: "Trancheuse à os n°2", marque: "ABO", modele: "GX5/350" },
    { secteur: "Boucherie / Charcuterie", nom: "Hachoir à viande classique", marque: "DADAUX (CRYOLITE)", modele: "TX98DC AVEC SECU" },
    { secteur: "Boucherie / Charcuterie", nom: "Hachoir réfrigéré", marque: "DADAUX (CRYOLITE)", modele: "CRYOLITE AR SC AVEC SECU" },
    { secteur: "Boucherie / Charcuterie", nom: "Mélangeur / malaxeur", marque: "DADAUX", modele: "PMX60" },
    { secteur: "Boucherie / Charcuterie", nom: "Poussoir à saucisses", marque: "DADAUX", modele: "PHX25" },
    { secteur: "Boucherie / Charcuterie", nom: "Grande scie électrique", marque: "DADAUX", modele: "SX 350" },
    { secteur: "Boucherie / Charcuterie", nom: "Petite scie électrique", marque: "DADAUX", modele: "J210" },
    { secteur: "Boucherie / Charcuterie", nom: "Affûteur électrique", marque: "CGT", modele: "ARROTINA" },
    { secteur: "Boucherie / Charcuterie", nom: "Glacière / déversoir (meuble réfrigéré libre-service)", modele: "L1MMM1-4.00" },
    { secteur: "Boucherie / Charcuterie", nom: "Présentoir réfrigéré (vitrine traditionnelle)", modele: "H1FMR1-4.02" },
    { secteur: "Boucherie / Charcuterie", nom: "Chambre froide positive Boucherie", modele: "MKC-NF-1135A" },
    { secteur: "Poissonnerie", nom: "Balance" },
    { secteur: "Poissonnerie", nom: "Stérilisateur" },
    { secteur: "Poissonnerie", nom: "Machine pondeuse à glace", modele: "RVH400" },
    { secteur: "Poissonnerie", nom: "Trancheuse" },
    { secteur: "Poissonnerie", nom: "Chambre froide positive Poissonnerie", modele: "MKC-NF-1135A" },
    { secteur: "Stock & Chambres froides", nom: "Meuble négatif 1 (surgelé)", modele: "SGDW5-C.05" },
    { secteur: "Stock & Chambres froides", nom: "Meuble négatif 2 (surgelé)", modele: "SGDW5-C.05" },
    { secteur: "Stock & Chambres froides", nom: "Meuble négatif 3 (fruits et légumes)", modele: "VLCU1-6.01" },
    { secteur: "Stock & Chambres froides", nom: "Meuble négatif 4 (produits laitiers)", modele: "SVLCU1-6.02" },
    { secteur: "Stock & Chambres froides", nom: "Centrale négative", modele: "BDV-SF71023A+A4" },
    { secteur: "Stock & Chambres froides", nom: "Centrale positive", modele: "MDW-TF20903A+A4" },
    { secteur: "Stock & Chambres froides", nom: "Chambre froide négative", modele: "BKC-NF-3235A" },
    { secteur: "Stock & Chambres froides", nom: "Chambre froide positive", modele: "MKC-NF-1135A" },
    { secteur: "Stock & Chambres froides", nom: "Chambre froide fruits et légumes", modele: "MKC-NF-1135A" },
    { secteur: "Caisse / Accueil", nom: "Caisse (x8 pour 4 postes)" },
    { secteur: "Caisse / Accueil", nom: "Rooftop 1", modele: "KCR5170RCS4W" },
    { secteur: "Caisse / Accueil", nom: "Rooftop 2", modele: "KCR5170RCS4W" },
    { secteur: "Caisse / Accueil", nom: "Porte à ouverture automatique" },
    { secteur: "Toilettes", nom: "Sèche-mains" },
  ],
  BONABERI: [
    { secteur: "Entrée / Caisses", nom: "Poste de caisse" },
    { secteur: "Entrée / Caisses", nom: "Caisse centrale" },
    { secteur: "Entrée / Caisses", nom: "Frigo Hadji", marque: "Hadji" },
    { secteur: "Entrée / Caisses", nom: "Frigo Sanden (Coca-Cola)", marque: "Sanden" },
    { secteur: "Entrée / Caisses", nom: "Frigo double battant Vital", marque: "Vital" },
    { secteur: "Entrée / Caisses", nom: "Frigo jus", marque: "EXHAL" },
    { secteur: "Rayon produit laitier", nom: "Maxi frigo 6 compartiments", marque: "EXHAL" },
    { secteur: "Rayon produit laitier", nom: "Groupement de frigos n°1", marque: "EXHAL" },
    { secteur: "Rayon produit laitier", nom: "Groupement de frigos n°2", marque: "EXHAL" },
    { secteur: "Rayon fruits et légumes", nom: "Maxi frigo", marque: "EXHAL" },
    { secteur: "Rayon fruits et légumes", nom: "Balance", marque: "Mettler Toledo" },
    { secteur: "Traiteur", nom: "Vitrine réfrigérée", marque: "EXHAL" },
    { secteur: "Traiteur", nom: "Rôtissoire", marque: "DOREGRILL", modele: "NANTAISE RB24 NE" },
    { secteur: "Traiteur", nom: "Plastifieuse / filmeuse", marque: "BEFOR TECHNITRANS", modele: "PFE 1101" },
    { secteur: "Traiteur", nom: "Trancheuse halal", marque: "DIAMOND", modele: "GX5/300" },
    { secteur: "Traiteur", nom: "Trancheuse non halal", marque: "ABO", modele: "GX5/350" },
    { secteur: "Traiteur", nom: "Fourneau 4 plaques électriques", marque: "DIAMOND", modele: "E7/CUE14LE" },
    { secteur: "Traiteur", nom: "Friteuse", marque: "L2G", modele: "EZ/FRE2V17" },
    { secteur: "Traiteur", nom: "Râpeuse électrique", marque: "SANTOS", modele: "Type 02" },
    { secteur: "Boucherie / Charcuterie", nom: "Sous-videuse", marque: "BEFOR TECHNITRANS", modele: "SVJ 420" },
    { secteur: "Boucherie / Charcuterie", nom: "Appareil à scier", marque: "DADAUX", modele: "SX 350 / J210" },
    { secteur: "Boucherie / Charcuterie", nom: "Hachoir", marque: "DADAUX (CRYOLITE)", modele: "TX98DC AVEC SECU" },
    { secteur: "Boucherie / Charcuterie", nom: "Poussoir", marque: "DADAUX", modele: "PHX25" },
    { secteur: "Boucherie / Charcuterie", nom: "Mélangeur", marque: "DADAUX", modele: "PMX60" },
    { secteur: "Boucherie / Charcuterie", nom: "Hachoir réfrigéré", marque: "DADAUX (CRYOLITE)", modele: "CRYOLITE AR SC AVEC SECU" },
    { secteur: "Boucherie / Charcuterie", nom: "Chambre froide positive boucherie", modele: "MKC-NF-1135A" },
    { secteur: "Atelier Stock", nom: "Chariot élévateur", marque: "TOYOTA", modele: "FVE62" },
    { secteur: "Atelier Stock", nom: "Gerbeur", modele: "TXH5400" },
    { secteur: "Atelier Stock", nom: "Presse à carton / presse à balles", modele: "COMPACTOR 3325" },
    { secteur: "IT", nom: "Onduleur", marque: "Schneider Electric" },
    { secteur: "Local photovoltaïque", nom: "Onduleur", marque: "Huawei" },
    { secteur: "Local photovoltaïque", nom: "Régulateur de tension triphasé", marque: "Delta", modele: "SRV 33" },
    { secteur: "Local chambres froides", nom: "Groupe centrale frigorifique multi-compresseurs", marque: "BOCK" },
  ],
  LOGPOM: [
    { secteur: "Entrée / Caisses", nom: "Poste de caisse" },
    { secteur: "Entrée / Caisses", nom: "Caisse centrale" },
    { secteur: "Entrée / Caisses", nom: "Frigo Hadji", marque: "Hadji" },
    { secteur: "Entrée / Caisses", nom: "Frigo Sanden (Coca-Cola)", marque: "Sanden" },
    { secteur: "Entrée / Caisses", nom: "Frigo double battant Vital", marque: "Vital" },
    { secteur: "Rayon produit laitier", nom: "Maxi frigo 6 compartiments", marque: "EXHAL" },
    { secteur: "Rayon produit laitier", nom: "Groupement de frigos n°1", marque: "EXHAL" },
    { secteur: "Rayon fruits et légumes", nom: "Maxi frigo", marque: "EXHAL" },
    { secteur: "Traiteur", nom: "Rôtissoire", marque: "DOREGRILL", modele: "NANTAISE RB24 NE" },
    { secteur: "Traiteur", nom: "Trancheuse halal", marque: "DIAMOND", modele: "GX5/300" },
    { secteur: "Traiteur", nom: "Trancheuse non halal", marque: "ABO", modele: "GX5/350" },
    { secteur: "Traiteur", nom: "Fourneau 4 plaques électriques", marque: "DIAMOND", modele: "E7/CUE14LE" },
    { secteur: "Boucherie / Charcuterie", nom: "Sous-videuse", marque: "BEFOR TECHNITRANS", modele: "SVJ 420" },
    { secteur: "Boucherie / Charcuterie", nom: "Hachoir", marque: "DADAUX (CRYOLITE)", modele: "TX98DC AVEC SECU" },
    { secteur: "Boucherie / Charcuterie", nom: "Poussoir", marque: "DADAUX", modele: "PHX25" },
    { secteur: "Boucherie / Charcuterie", nom: "Mélangeur", marque: "DADAUX", modele: "PMX60" },
    { secteur: "Boucherie / Charcuterie", nom: "Chambre froide positive boucherie", modele: "MKC-NF-1135A" },
    { secteur: "Atelier Stock", nom: "Presse à carton", modele: "COMPACTOR 3325" },
    { secteur: "IT", nom: "Onduleur", marque: "Schneider Electric" },
    { secteur: "Local photovoltaïque", nom: "Onduleur", marque: "Huawei" },
    { secteur: "Local chambres froides", nom: "Groupe centrale frigorifique", marque: "BOCK" },
  ],
  ANCIEN_DALIP: [
    { secteur: "Compartiment froid", nom: "Tombeaux (meuble négatif)" },
    { secteur: "Compartiment froid", nom: "Meuble positif PLS" },
    { secteur: "Compartiment froid", nom: "Présentoir réfrigéré fruits" },
    { secteur: "Compartiment froid", nom: "Frigo Coca-Cola", marque: "Coca-Cola" },
    { secteur: "Compartiment froid", nom: "Frigo Castel", marque: "Castel" },
    { secteur: "Fruits & Légumes", nom: "Rooftop" },
    { secteur: "Fruits & Légumes", nom: "Climatiseur", marque: "Gree" },
    { secteur: "Boucherie", nom: "Scie électrique" },
    { secteur: "Boucherie", nom: "Hachoir réfrigéré" },
    { secteur: "Boucherie", nom: "Mélangeuse électrique" },
    { secteur: "Boucherie", nom: "Poussoir électrique" },
    { secteur: "Boucherie", nom: "Chambre froide négative" },
    { secteur: "Cuisine / Restauration (Traiteur)", nom: "Cuisinière électrique (four 4 feux)", marque: "DIAMOND", modele: "E7/CUE14LE" },
    { secteur: "Cuisine / Restauration (Traiteur)", nom: "Friteuse électrique", marque: "L2G", modele: "EZ/FRE2V17" },
    { secteur: "Cuisine / Restauration (Traiteur)", nom: "Four à pizza", modele: "366-1010" },
    { secteur: "Cuisine / Restauration (Traiteur)", nom: "Machine à kebab", marque: "DOREGRILL", modele: "NANTAISE RB24 NE" },
  ],
};

async function main() {
  const password = await bcrypt.hash("admin123", 10);

  for (const site of SITES) {
    const supermarket = await prisma.supermarket.upsert({
      where: { code: site.code },
      update: {},
      create: { nom: site.nom, code: site.code },
    });
    console.log(`✓ Supermarché: ${site.nom}`);

    // Get unique sectors for this site (fallback to BONAMOUSSADI model)
    const equipment = EQUIPMENT_BY_SITE[site.code] || EQUIPMENT_BY_SITE["BONAMOUSSADI"] || [];
    const sectorNames = [...new Set(equipment.map((e) => e.secteur))];

    const departments = new Map<string, string>();

    for (const sector of sectorNames) {
      const dep = await prisma.localisation.create({
        data: { nom: sector, supermarketId: supermarket.id },
      });
      departments.set(sector, dep.id);
    }
    console.log(`  Departments créés: ${sectorNames.length}`);

    for (const eq of equipment) {
      const depId = departments.get(eq.secteur);
      const description = [eq.marque, eq.modele].filter(Boolean).join(" / ");
      await prisma.equipment.create({
        data: {
          nom: eq.nom,
          description: description || null,
          supermarketId: supermarket.id,
          localisationId: depId,
          corpsEtat: CORPS_ETAT_MAP[eq.secteur] || null,
          criticite: "moyenne",
        },
      });
    }
    console.log(`  Équipements créés: ${equipment.length}`);
  }

  // Create maintenanciers for key sites
  const maintenanciers = [
    { nom: "Alvin N", email: "alvin@gmao.local", supermarketCode: "BONAMOUSSADI" },
    { nom: "Technicien Bonaberi", email: "tech.bonaberi@gmao.local", supermarketCode: "BONABERI" },
  ];
  for (const m of maintenanciers) {
    const supermarket = await prisma.supermarket.findUnique({ where: { code: m.supermarketCode } });
    await prisma.user.upsert({
      where: { email: m.email },
      update: {},
      create: { nom: m.nom, email: m.email, password, role: "MAINTENANCIER", supermarketId: supermarket?.id },
    });
    console.log(`  Maintenancier: ${m.nom}`);
  }

  console.log("\n✅ Import terminé !");
}

main().catch(console.error).finally(() => prisma.$disconnect());
